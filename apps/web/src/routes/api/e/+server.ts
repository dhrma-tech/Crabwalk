import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { EVENTS } from '#lib/analytics.ts';
import { logEvent } from '#lib/server/analytics.ts';
import type { RequestHandler } from './$types';

// POST /api/e (hardening T1-11): one analytics event from `track()` (JSON, also as a beacon). Allow-listed names,
// small scalar props, ≤ 2 KB; the server adds the day, language and session hash. Nothing identifying is stored.
const body = z.object({
	name: z.enum(EVENTS),
	props: z
		.record(
			z.string().regex(/^[a-z_]{1,30}$/),
			z.union([z.number(), z.boolean(), z.string().max(40)])
		)
		.refine((p) => Object.keys(p).length <= 8)
		.default({}),
	route: z.string().max(120).nullish()
});

export const POST: RequestHandler = async (event) => {
	const text = await event.request.text();
	if (text.length > 2048) error(413, 'too large');
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch {
		error(400, 'bad request');
	}
	const b = body.safeParse(json);
	if (!b.success) error(400, 'bad request');
	await logEvent(event, b.data.name, b.data.props, b.data.route ?? null);
	return new Response(null, { status: 204 });
};
