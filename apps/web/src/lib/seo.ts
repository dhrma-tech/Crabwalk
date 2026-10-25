// Pages that are personal, staff-only, token-protected or utility: not for search engines.
// Used by robots.txt (Disallow) and hooks.server.ts (X-Robots-Tag: noindex).
export const PRIVATE_PREFIXES = [
	'/admin',
	'/owner',
	'/api/',
	'/plan/',
	'/trip/',
	'/me',
	'/login',
	'/auth/',
	'/q/',
	'/crabby',
	'/navigate',
	'/prefs',
	'/ola/',
	'/dev/'
] as const;

export const isPrivatePath = (path: string) =>
	PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(p.endsWith('/') ? p : `${p}/`));
