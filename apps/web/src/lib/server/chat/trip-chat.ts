// Trip group chat (P12 step G, product plan 10.8). Every message — a tripmate's after moderation, Crabby's after
// it is built — is signed here (HMAC, CRABBY_SIGNING_KEY = Vault crabby_key) and inserted by post_trip_message,
// so nobody can skip moderation or post as Crabby through the API (DECISIONS P12-4). Messages are deleted 30 days
// after the trip ends (P12-2).
import type { SupabaseClient } from '@supabase/supabase-js';
import { CRABBY_SIGNING_KEY } from '$app/env/private';
import type { Database } from '#lib/db.types.ts';
import { chain, route } from '../ai/router.ts';

type DB = SupabaseClient<Database>;
export type Kind = Database['public']['Enums']['message_kind'];

async function sign(text: string) {
	if (!CRABBY_SIGNING_KEY) throw new Error('CRABBY_SIGNING_KEY not set');
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(CRABBY_SIGNING_KEY),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
	return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Post one message as the signed-in tripmate (or Crabby, replying on their behalf). */
export async function postMessage(
	db: DB,
	trip: string,
	m: { kind: Kind; body: string | null; payload?: unknown; crabby?: boolean; proactive?: boolean }
) {
	const nonce = crypto.randomUUID();
	const payload = m.payload === undefined ? null : JSON.stringify(m.payload);
	const crabby = !!m.crabby;
	const proactive = !!m.proactive;
	// Same fields and order as post_trip_message: booleans as t/f, payload as the exact JSON text.
	const sig = await sign(
		[
			trip,
			m.kind,
			crabby ? 't' : 'f',
			proactive ? 't' : 'f',
			nonce,
			m.body ?? '',
			payload ?? ''
		].join('|')
	);
	const { data, error } = await db.rpc('post_trip_message', {
		_trip: trip,
		_kind: m.kind,
		_body: m.body as string,
		_payload: payload as string,
		_crabby: crabby,
		_proactive: proactive,
		_nonce: nonce,
		_sig: sig
	});
	if (error) throw error;
	return data;
}

const SCREEN = `You screen messages in a travel group's chat for the Konkan coast (India). Reply ONLY with JSON
{"safe": true|false}. Unsafe = sexual content, hate, harassment, threats, self-harm instructions, illegal activity,
spam. Ordinary planning talk, jokes and disagreements are safe.`;

/** Moderation for people's messages (small fast model, product plan §4). Fails closed if no model answers. */
export async function screen(text: string) {
	const r = await route(chain('intent'), {
		messages: [
			{ role: 'system', content: SCREEN },
			{ role: 'user', content: text.slice(0, 2000) }
		],
		json: true,
		maxTokens: 20
	}).catch(() => null);
	return !!r && !/"safe"\s*:\s*false/.test(r.content);
}

export type ChatMessage = {
	id: string;
	author: string | null;
	mine: boolean;
	crabby: boolean;
	proactive: boolean;
	kind: Kind;
	body: string | null;
	payload: Record<string, unknown> | null;
	at: string;
	/** Polls: votes per option and the options I picked. */
	tally?: number[];
	picked?: number[];
};

/** The latest messages with authors' names and poll tallies. */
export async function listChat(db: DB, trip: string, userId: string): Promise<ChatMessage[]> {
	const [{ data: msgs }, { data: mates }, { data: votes }] = await Promise.all([
		db
			.from('trip_messages')
			.select('id, member_id, from_crabby, proactive, kind, body, payload, created_at')
			.eq('trip_id', trip)
			.order('created_at', { ascending: false })
			.limit(80),
		db.from('trip_members').select('id, display_name, user_id').eq('trip_id', trip),
		db.from('trip_poll_votes').select('message_id, member_id, options').eq('trip_id', trip)
	]);
	const name = new Map((mates ?? []).map((t) => [t.id, t.display_name]));
	const me = (mates ?? []).find((t) => t.user_id === userId)?.id;
	return (msgs ?? []).reverse().map((x) => {
		const payload = (x.payload ?? null) as Record<string, unknown> | null;
		const base: ChatMessage = {
			id: x.id,
			author: x.from_crabby ? null : (name.get(x.member_id ?? '') ?? null),
			mine: !x.from_crabby && !!me && x.member_id === me,
			crabby: x.from_crabby,
			proactive: x.proactive,
			kind: x.kind,
			body: x.body,
			payload,
			at: x.created_at
		};
		if (x.kind !== 'poll') return base;
		const n = ((payload?.options as unknown[]) ?? []).length;
		const mine = (votes ?? []).filter((v) => v.message_id === x.id);
		return {
			...base,
			tally: Array.from({ length: n }, (_, i) => mine.filter((v) => v.options.includes(i)).length),
			picked: mine.find((v) => v.member_id === me)?.options ?? []
		};
	});
}
