// Crabby conversation for this tab only (memory; BACKEND §11.4: nothing stored server-side).
// Emergency keywords are caught HERE, before any network call (§11.6).
import { page } from '$app/state';
import { isEmergency } from './emergency.ts';
import { m } from './paraglide/messages.js';
import type { DriveStep, PageName } from './drive.ts';
import type { Question } from './questions.ts';
import { drive } from './drive.svelte.ts';
import type { ReelResult } from './server/ai/reel.ts';

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
	/** Snap and ask (P12): what Crabby matched, "not sure", or that photos are switched off. */
	snap?:
		| { kind: 'match'; type: 'place' | 'dish'; name: string; story: string | null; href: string }
		| { kind: 'unsure'; description: string }
		| { kind: 'consent' };
	/** Reel to trip (P12): reality checks for the places a reel shows, or "Not in our list yet". */
	reel?: ReelResult | { kind: 'consent' };
	answered?: boolean;
};

/** A question the user asked our team (10.1): Pending until a verifier answers. */
export type TeamQuestion = {
	id: string;
	question: string;
	status: 'open' | 'answered' | 'expired' | 'closed';
	answer: string | null;
	answered_on: string | null;
	/** Answered and not shown yet. */
	fresh: boolean;
};

export const crabby = $state({
	team: [] as TeamQuestion[],
	/** QR code of the spot the user scanned (/crabby?spot=…): Crabby answers about that place. */
	spot: null as string | null,
	turns: [] as Bubble[],
	busy: false,
	remaining: null as number | null,
	emergency: false,
	signin: false,
	/** After an Instagram link: the next message or photo is that reel's caption / screenshot. */
	reelNext: null as string | null
});

const REEL_URL = /https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be|instagram\.com)\/\S+/i;
/** A pasted reel caption: two or more hashtags. */
const CAPTION = /#[\p{L}\p{N}_]+[\s\S]*#[\p{L}\p{N}_]+/u;

export async function ask(text: string) {
	const message = text.trim();
	if (!message || crabby.busy) return;
	if (isEmergency(message)) {
		crabby.emergency = true; // EmergencyCard; no request is made
		return;
	}
	const url = REEL_URL.exec(message)?.[0] ?? null;
	if (url || crabby.reelNext || CAPTION.test(message))
		return reel(message, {
			url: url ?? crabby.reelNext,
			caption: message.replace(url ?? '', '').trim()
		});
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
			body: JSON.stringify({ message, history, path: page.url.pathname, spot: crabby.spot })
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

/** The user's questions to our team; new answers are marked seen once shown. */
export async function loadTeamQuestions() {
	const r = await fetch('/api/me/questions').catch(() => null);
	if (!r?.ok) return;
	crabby.team = (await r.json()) as TeamQuestion[];
	if (crabby.team.some((q) => q.fresh))
		void fetch('/api/me/questions', { method: 'POST' }).catch(() => {});
}

/** Send a question card's answers as the next message. */
/** Re-encode on the phone: ≤ 1024 px JPEG, which also drops EXIF/GPS (P12 snap and ask). */
async function shrink(file: File) {
	const bmp = await createImageBitmap(file);
	const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
	const c = document.createElement('canvas');
	c.width = Math.round(bmp.width * scale);
	c.height = Math.round(bmp.height * scale);
	c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
	return c.toDataURL('image/jpeg', 0.8);
}
/** The traveller's position only if they already allowed it — used to rank our places, never sent to the AI. */
async function whereIfAllowed() {
	const p = await navigator.permissions?.query({ name: 'geolocation' }).catch(() => null);
	if (p?.state !== 'granted') return null;
	return new Promise<{ lon: number; lat: number } | null>((ok) =>
		navigator.geolocation.getCurrentPosition(
			(g) => ok({ lon: g.coords.longitude, lat: g.coords.latitude }),
			() => ok(null),
			{ timeout: 5000, maximumAge: 300_000 }
		)
	);
}

/** Snap and ask: a photo (+ optional question) → what it is, from our places and dishes. */
export async function snap(file: File, caption: string) {
	if (crabby.busy) return;
	if (crabby.reelNext) return reel(caption.trim() || m.snap_sent(), { image: file, caption });
	crabby.turns.push({ role: 'user', content: caption.trim() || m.snap_sent() });
	crabby.busy = true;
	try {
		const [image, near] = await Promise.all([shrink(file), whereIfAllowed()]);
		const res = await fetch('/api/ai/snap', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ image, caption, near })
		});
		if (res.status === 401) {
			crabby.signin = true;
			crabby.turns.pop();
			return;
		}
		const r = (await res.json()) as
			NonNullable<Bubble['snap']> | { kind: 'limit' } | { kind: 'unavailable' };
		if (r.kind === 'match' || r.kind === 'unsure' || r.kind === 'consent')
			crabby.turns.push({ role: 'assistant', content: '', snap: r });
		else crabby.turns.push({ role: 'assistant', content: '', kind: r.kind });
	} catch {
		crabby.turns.push({ role: 'assistant', content: '', kind: 'unavailable' });
	} finally {
		crabby.busy = false;
	}
}

/** Reel to trip: a YouTube / Instagram link, a caption or a screenshot → reality checks + "Add to trip". */
async function reel(shown: string, input: { url?: string | null; caption?: string; image?: File }) {
	crabby.turns.push({ role: 'user', content: shown });
	const url = input.url ?? null;
	crabby.reelNext = null;
	crabby.busy = true;
	try {
		const image = input.image ? await shrink(input.image) : null;
		const res = await fetch('/api/ai/reel', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url, caption: input.caption ?? '', image })
		});
		if (res.status === 401) {
			crabby.signin = true;
			crabby.turns.pop();
			return;
		}
		if (res.status === 400) throw new Error('not a reel');
		const r = (await res.json()) as
			NonNullable<Bubble['reel']> | { kind: 'limit' } | { kind: 'unavailable' };
		if (r.kind === 'limit' || r.kind === 'unavailable')
			crabby.turns.push({ role: 'assistant', content: '', kind: r.kind });
		else {
			if (r.kind === 'need_caption') crabby.reelNext = url;
			crabby.turns.push({
				role: 'assistant',
				content: '',
				reel: r,
				...(r.kind === 'found' && r.action ? { actions: [r.action] } : {})
			});
		}
	} catch {
		crabby.turns.push({ role: 'assistant', content: '', kind: 'unavailable' });
	} finally {
		crabby.busy = false;
	}
}

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
