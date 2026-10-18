// Crabby conversation for this tab only (memory; BACKEND §11.4: nothing stored server-side).
// Emergency keywords are caught HERE, before any network call (§11.6).
import { isEmergency } from './emergency.ts';

export type Preview = { title: string; lines: string[]; links?: { label: string; href: string }[] };
export type Action = {
	id: string;
	type: string;
	preview: Preview;
	state?: 'applied' | 'discarded' | 'busy';
};
export type Bubble = {
	role: 'user' | 'assistant';
	content: string;
	kind?: 'refused' | 'unavailable' | 'limit' | 'unknown';
	actions?: Action[];
	alternatives?: { slug: string; name: string }[];
};

export const crabby = $state({
	turns: [] as Bubble[],
	busy: false,
	remaining: null as number | null,
	emergency: false,
	signin: false
});

export async function ask(text: string) {
	const message = text.trim();
	if (!message || crabby.busy) return;
	if (isEmergency(message)) {
		crabby.emergency = true; // EmergencyCard; no request is made
		return;
	}
	const history = crabby.turns
		.filter((t) => !t.kind && t.content)
		.slice(-6)
		.map((t) => ({ role: t.role, content: t.content }));
	crabby.turns.push({ role: 'user', content: message });
	crabby.busy = true;
	try {
		const res = await fetch('/api/ai/chat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ message, history })
		});
		if (res.status === 401) {
			crabby.signin = true;
			crabby.turns.pop();
			return;
		}
		const r = (await res.json()) as
			| { kind: 'emergency' }
			| { kind: 'limit' }
			| { kind: 'refused' | 'unavailable'; remaining: number }
			| {
					kind: 'answer';
					reply: string;
					actions: Action[];
					alternatives: Bubble['alternatives'];
					remaining: number;
			  };
		if (r.kind === 'emergency') crabby.emergency = true;
		else if (r.kind === 'limit') {
			crabby.remaining = 0;
			crabby.turns.push({ role: 'assistant', content: '', kind: 'limit' });
		} else if (r.kind === 'answer') {
			crabby.remaining = r.remaining;
			const unknown = !r.actions.length && !!r.alternatives?.length;
			crabby.turns.push({
				role: 'assistant',
				content: r.reply,
				actions: r.actions,
				alternatives: r.alternatives,
				...(unknown ? { kind: 'unknown' as const } : {})
			});
		} else {
			crabby.remaining = r.remaining;
			crabby.turns.push({ role: 'assistant', content: '', kind: r.kind });
		}
	} catch {
		crabby.turns.push({ role: 'assistant', content: '', kind: 'unavailable' });
	} finally {
		crabby.busy = false;
	}
}

/** Apply / Discard a preview. Returns where to go next (our page or Google Maps) when applied. */
export async function decide(a: Action, apply: boolean): Promise<string | null> {
	a.state = 'busy';
	const res = await fetch(`/api/ai/actions/${a.id}/${apply ? 'apply' : 'discard'}`, {
		method: 'POST'
	}).catch(() => null);
	if (!res?.ok) {
		a.state = undefined;
		return null;
	}
	a.state = apply ? 'applied' : 'discarded';
	return ((await res.json()) as { href: string | null }).href;
}
