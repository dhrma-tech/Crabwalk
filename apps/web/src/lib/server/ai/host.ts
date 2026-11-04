// Host Crabby (P12 step J, product plan 10.4): an owner (or our team) speaks or types in Marathi, Hindi or English
// and Crabby fills the listing's fact fields — prices, menu, opening hours, contact. Facts only, never ratings or
// reviews; the owner reviews every field before saving (the usual owner edit path). Phone numbers are read here
// with a plain pattern and never sent to the model (AI firewall: no phone numbers in LLM payloads).
import { z } from 'zod';
import type { Msg } from './providers.ts';
import { chain, route } from './router.ts';

export type HostFill = {
	price_min?: number;
	price_max?: number;
	price_for_two?: number;
	menu_add?: string[];
	hours?: { days: number[]; opens?: string; closes?: string; closed?: boolean }[];
	phone?: string;
	whatsapp?: string;
};

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const fill = z.object({
	price_min: z.number().int().min(0).max(1_000_000).optional(),
	price_max: z.number().int().min(0).max(1_000_000).optional(),
	price_for_two: z.number().int().min(0).max(100_000).optional(),
	menu_add: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
	hours: z
		.array(
			z.object({
				days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
				opens: time.optional(),
				closes: time.optional(),
				closed: z.boolean().optional()
			})
		)
		.max(7)
		.optional()
});

const PHONE = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g;
const prompt = (
	type: 'stay' | 'eatery'
) => `You fill a ${type === 'stay' ? 'homestay' : 'eatery'} owner's listing form
from what they said (Marathi, Hindi or English). Reply ONLY with JSON containing just the fields they stated:
${
	type === 'stay'
		? '"price_min" and "price_max" (₹ per night, numbers)'
		: '"price_for_two" (₹, number), "menu_add" (dish names to add, in their words)'
}, "hours": [{"days": [0-6, Sunday = 0], "opens": "HH:MM", "closes": "HH:MM"} or {"days": [...], "closed": true}].
Never guess a field they did not mention. Never include ratings, reviews or opinions. {} if nothing applies.`;

/** Fields to fill from the owner's words. Phones by pattern (local); the rest by a small model. */
export async function hostFill(type: 'stay' | 'eatery', text: string): Promise<HostFill> {
	const phones = [...text.matchAll(PHONE)].map((x) => x[0].replace(/[\s-]/g, ''));
	const out: HostFill = {};
	if (phones[0]) out.phone = phones[0];
	if (/whats\s?app|व्हॉट्सॲप|व्हाट्सएप/i.test(text) && phones.length) out.whatsapp = phones.at(-1);
	const messages: Msg[] = [
		{ role: 'system', content: prompt(type) },
		{ role: 'user', content: text.replace(PHONE, '[phone]').slice(0, 1500) }
	];
	const r = await route(chain('intent'), { messages, json: true, maxTokens: 400 }).catch(
		() => null
	);
	let raw: unknown = {};
	try {
		raw = JSON.parse(r?.content ?? '{}');
	} catch {
		/* model gave no JSON: only the phones */
	}
	const f = fill.safeParse(raw);
	if (!f.success) return out;
	const keep =
		type === 'stay' ? ['price_min', 'price_max', 'hours'] : ['price_for_two', 'menu_add', 'hours'];
	for (const k of keep) {
		const v = f.data[k as keyof typeof f.data];
		if (v !== undefined) (out as Record<string, unknown>)[k] = v;
	}
	return out;
}
