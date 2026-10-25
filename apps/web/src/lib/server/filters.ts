import { z } from 'zod';
import { Constants } from '#lib/db.types.ts';
import { AMENITIES, DIETS, VIBES } from '#lib/vocab.ts';

// List filters (BACKEND §14). Keys are the URL parameter names, shared by the list pages and /api/*.
const E = Constants.public.Enums;
const price = z.coerce.number().int().min(1).max(1_000_000);
export const placeFilter = z
	.object({ category: z.enum(E.place_category), hidden_gem: z.literal('1') })
	.partial();
export const stayFilter = z
	.object({
		vibe: z.enum(VIBES),
		style: z.enum(E.service_style),
		amenity: z.enum(AMENITIES),
		max_price: price
	})
	.partial();
export const eateryFilter = z
	.object({ diet: z.enum(DIETS), authenticity: z.enum(E.eatery_authenticity), max_price: price })
	.partial();

/** URL params → filter. `strict` (API): any bad value → null, answer 400. Pages: bad values are dropped so
 *  an old or hand-edited link still shows the list. Empty values (an unset <select>) are ignored. */
export function readFilter<S extends z.ZodObject>(
	schema: S,
	params: URLSearchParams,
	strict = false
): z.infer<S> | null {
	const raw = Object.fromEntries([...params].filter(([k, v]) => v !== '' && k in schema.shape));
	const all = schema.safeParse(raw);
	if (all.success) return all.data;
	if (strict) return null;
	return Object.fromEntries(
		Object.entries(raw).flatMap(([k, v]) => {
			const r = (schema.shape[k] as z.ZodType).safeParse(v);
			return r.success ? [[k, r.data]] : [];
		})
	) as z.infer<S>;
}
