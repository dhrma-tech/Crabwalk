import { getLocale } from '#lib/paraglide/runtime.js';

// Copy for the field-journal pages (PLAN.md §1): each string carries all three languages, so data and copy live in
// one typed file. HI/MR are Claude drafts awaiting native review (docs/crabwalk-handoff/HANDOFF.md).
export type Locale = 'en' | 'hi' | 'mr';
export type L = { en: string; hi: string; mr: string };

export const locale = (): Locale => {
	const l = getLocale();
	return l === 'hi' || l === 'mr' ? l : 'en';
};

/** The string for the current (or given) locale; English when a draft is missing. */
export const tr = (l: L, loc: Locale = locale()) => l[loc] || l.en;

/** Same text in every language (names, numbers, prices). */
export const same = (s: string): L => ({ en: s, hi: s, mr: s });

/** True when the text is mostly Devanagari, so it gets the Devanagari face and line height. */
export const isDeva = (s: string) => /[ऀ-ॿ]/.test(s);

/**
 * Calls back once the page has loaded and the Devanagari face is in (PLAN.md §4): English journal pages paint
 * Devanagari in the system font first, then switch, so the font file stays out of the first paint.
 */
export function whenDevaReady(cb: () => void) {
	const go = () => {
		const f = document.fonts?.load("400 1em 'Tiro Devanagari Marathi'", 'क');
		(f ?? Promise.resolve()).then(cb, cb);
	};
	const soon = () => setTimeout(go, 150);
	if (document.readyState === 'complete') soon();
	else addEventListener('load', soon, { once: true });
}
