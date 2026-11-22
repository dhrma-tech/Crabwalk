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
