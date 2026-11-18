import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import { session } from '#lib/server/auth.ts';
import { crabbyTurn, type TurnIO } from '#lib/server/ai/chat.ts';
import { CODE_RE } from '#lib/server/qr.ts';
import type { Lang } from '#lib/server/listings.ts';
import type { RequestHandler } from './$types';

const body = z.object({
	message: z.string().trim().min(1).max(1000),
	history: z
		.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) }))
		.max(20)
		.default([]),
	// The page the user is on (P12 drive: context + the trip workspace's sections).
	path: z
		.string()
		.regex(/^\/[\w\-/]{0,200}$/)
		.nullable()
		.default(null),
	// QR code of the spot the user scanned (P12 at the spot).
	spot: z.string().regex(CODE_RE).nullable().default(null)
});

// POST /api/ai/chat — login required (BACKEND §11.5); nothing about the conversation is stored.
// `Accept: text/event-stream` (T2-02): events `status`, `delta` (reply text as written), then one `final` with the
// same object the JSON answer has, or `error`. Without it: the JSON answer, as before.
export const POST: RequestHandler = async (event) => {
	const { user } = await session(event);
	const b = body.safeParse(await event.request.json().catch(() => null));
	if (!b.success) error(400, 'bad request');
	// SEC-11: guests get shorter messages and fewer tool rounds.
	const guest = !!user.is_anonymous;
	if (guest && b.data.message.length > 500) error(400, 'message too long');
	const turn = (io: TurnIO) =>
		crabbyTurn(
			event.locals.supabase,
			user.id,
			getLocale() as Lang,
			b.data.message,
			b.data.history,
			b.data.path,
			b.data.spot,
			guest,
			{ ...io, defer: (p) => event.platform?.ctx?.waitUntil?.(p) }
		);

	if (!event.request.headers.get('accept')?.includes('text/event-stream')) {
		const r = await turn({});
		return json(r, { status: r.kind === 'limit' ? 429 : 200 });
	}
	const enc = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		async start(c) {
			const send = (name: string, data: unknown) =>
				c.enqueue(enc.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`));
			// The first event goes out with the response (AI-01: status within 300 ms), before the cap check.
			send('status', { step: 'thinking' });
			try {
				send('final', await turn({ emit: (e) => send(e.event, e.data) }));
			} catch {
				send('error', { kind: 'unavailable' });
			}
			c.close();
		}
	});
	return new Response(stream, {
		headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-store' }
	});
};
