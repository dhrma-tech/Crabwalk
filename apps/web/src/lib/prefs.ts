export const THEME_COOKIE = 'theme';
export type Theme = 'light' | 'dark';
export const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark';

/** Same-origin relative path only (blocks open redirects like //evil.com). */
export const safeReturnPath = (v: unknown) =>
	typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\')
		? v
		: '/';
