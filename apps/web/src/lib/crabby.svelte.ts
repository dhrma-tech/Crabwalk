// Crabby conversation for this tab only (memory; BACKEND §11.4: nothing stored server-side).
// Emergency keywords are caught HERE, before any network call (§11.6).
import { page } from '$app/state';
import { isEmergency } from './emergency.ts';
import { m } from './paraglide/messages.js';
import type { DriveStep, PageName } from './drive.ts';
import type { Question } from './questions.ts';
import { drive } from './drive.svelte.ts';

const PAGE_NAME: Record<PageName, () => string> = {
	discover: m.nav_discover,
	map: m.nav_map,
	stays: m.stays_title,
	food: m.food_title,
	taste_konkan: m.taste_title,
	itineraries: m.itin_title,
	start: m.start_title,
	plan_new: m.plan_new,
	me: m.nav_me,
	crabby: m.nav_crabby
};
const SECTION_NAME: Record<string, () => string> = {
	overview: m.plan_overview,
	places: m.plan_places,
	itinerary: m.plan_itinerary,
	expenses: m.plan_expenses,
	notes: m.plan_notes,
	publish: m.plan_publish_title
};
/** Status line for a step ("Crabby: opening Stays"). */
export function stepLabel(s: DriveStep): string {
	switch (s.action) {
		case 'openPage':
			return m.drive_open_page({ page: PAGE_NAME[s.page]() });
		case 'openListing':
			return m.drive_open_listing();
		case 'setFilters':
			return m.drive_filters({ page: PAGE_NAME[s.page]() });
		case 'openMap':
			return m.drive_map();
		case 'openTrip':
			return m.drive_trip();
		case 'switchTab':
			return m.drive_tab({ section: (SECTION_NAME[s.section] ?? m.plan_overview)() });
	}
}

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
	/** "Ask, don't assume" card; answered once the user sends their picks. */
	questions?: Question[];
	answered?: boolean;
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
			body: JSON.stringify({ message, history, path: page.url.pathname })
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
					drive: DriveStep[];
					questions: Question[] | null;
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
				...(r.questions?.length ? { questions: r.questions } : {}),
				...(unknown ? { kind: 'unknown' as const } : {})
			});
			// Crabby drives the app (10.11): auto steps run now, visibly, with Stop.
			if (r.drive?.length) void drive(r.drive, stepLabel);
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

/** Send a question card's answers as the next message. */
export async function answerCard(t: Bubble, text: string) {
	t.answered = true;
	await ask(text);
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
