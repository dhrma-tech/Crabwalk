// Crabby drives the app (P12 §3, product plan 10.11): the named actions Crabby may take on its own. The server
// checks the model's choices against these (allowlist: only traveller pages — never admin, verifier or owner
// pages — and only the user's own trips); the browser runs them through drive.svelte.ts, where the buttons that do
// the same thing register the same functions. Anything that changes data or leaves the site is not here: it stays
// a preview the user applies (ai_actions).
import { z } from 'zod';

/** Pages Crabby may open. */
export const PAGES = {
	discover: '/',
	map: '/map',
	stays: '/stays',
	food: '/food',
	taste_konkan: '/taste-konkan',
	itineraries: '/itineraries',
	start: '/start',
	plan_new: '/plan/new',
	me: '/me',
	crabby: '/crabby'
} as const;
export type PageName = keyof typeof PAGES;
const LISTING = {
	place: '/place',
	stay: '/stays',
	eatery: '/food',
	dish: '/taste-konkan'
} as const;
/** Plan workspace sections (P11), in page order. */
export const SECTIONS = [
	'overview',
	'places',
	'itinerary',
	'expenses',
	'chat',
	'notes',
	'publish'
] as const;

const slug = z.string().regex(/^[a-z0-9-]{1,120}$/);
export const driveStep = z.discriminatedUnion('action', [
	z.object({
		action: z.literal('openPage'),
		page: z.enum(Object.keys(PAGES) as [PageName, ...PageName[]])
	}),
	z.object({
		action: z.literal('openListing'),
		type: z.enum(['place', 'stay', 'eatery', 'dish']),
		slug
	}),
	z.object({
		action: z.literal('setFilters'),
		page: z.enum(['discover', 'stays', 'food']),
		filters: z.record(z.string().max(20), z.string().max(40))
	}),
	z.object({
		action: z.literal('openMap'),
		focus: z.object({ type: z.enum(['place', 'stay', 'eatery']), slug }).optional(),
		alerts: z.boolean().optional()
	}),
	z.object({ action: z.literal('openTrip'), trip: z.uuid() }),
	z.object({
		action: z.literal('switchTab'),
		section: z.enum(SECTIONS),
		day: z.number().int().min(1).max(7).optional()
	})
]);
export type DriveStep = z.infer<typeof driveStep>;

/** Where a step goes; null = it runs on the open page (switchTab). */
export function hrefOf(s: DriveStep): string | null {
	switch (s.action) {
		case 'openPage':
			return PAGES[s.page];
		case 'openListing':
			return `${LISTING[s.type]}/${s.slug}`;
		case 'setFilters': {
			const q = new URLSearchParams(s.filters);
			return `${PAGES[s.page]}${q.size ? `?${q}` : ''}`;
		}
		case 'openMap': {
			const q = new URLSearchParams();
			if (s.focus) q.set('focus', `${s.focus.type}/${s.focus.slug}`);
			if (s.alerts) q.set('layers', 'alerts');
			return `/map${q.size ? `?${q}` : ''}`;
		}
		case 'openTrip':
			return `/plan/${s.trip}`;
		case 'switchTab':
			return null;
	}
}

/** The element Crabby visibly "taps" for a step (the button or link a person would use), if it is on screen. */
export function targetOf(s: DriveStep): string {
	switch (s.action) {
		case 'openPage':
			return `[data-drive="openPage:${s.page}"]`;
		case 'openListing':
			return `a[href="${hrefOf(s)}"]`;
		case 'setFilters':
			return '[data-drive="setFilters"]';
		case 'openMap':
			return '[data-drive="openPage:map"]';
		case 'openTrip':
			return `a[href="${hrefOf(s)}"]`;
		case 'switchTab':
			return `[data-drive="switchTab:${s.section}"]`;
	}
}
