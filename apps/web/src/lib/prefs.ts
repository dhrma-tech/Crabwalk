export const THEME_COOKIE = 'theme';
export type Theme = 'light' | 'dark';
export const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark';

/** Hardening T3-03 (F3): monsoon mode. On from June to September (IST) unless the visitor's cookie says otherwise. */
export const MONSOON_COOKIE = 'monsoon';
export function monsoonMode(cookie: string | undefined, now = Date.now()) {
	if (cookie === 'on') return true;
	if (cookie === 'off') return false;
	const month = new Date(now + 5.5 * 3600e3).getUTCMonth() + 1;
	return month >= 6 && month <= 9;
}
/** Closures first, then risky, then open; the sort is stable, so the list's own order holds within each group. */
const RANK = { closed: 0, risky: 1, open: 2 } as const;
export const byMonsoon = <T extends { monsoon: keyof typeof RANK }>(rows: T[]) =>
	[...rows].sort((a, b) => RANK[a.monsoon] - RANK[b.monsoon]);

/** Same-origin relative path only (blocks open redirects like //evil.com). */
export const safeReturnPath = (v: unknown) =>
	typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\')
		? v
		: '/';
