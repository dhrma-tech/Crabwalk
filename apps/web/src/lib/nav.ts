// Which nav item is current: Discover only on "/discover" (the landing is "/"), every other item for its first path segment, so the Plan item
// (/plan/new) stays current on /plan/:id and the vote page.
export function isActive(path: string, href: string) {
	if (href === '/') return path === '/';
	const base = href.split('/').slice(0, 2).join('/');
	return path === base || path.startsWith(`${base}/`);
}

/** Field-journal pages (landing, onboarding, Crabby sheet) carry their own nav: no app nav bar or Crabby dock. */
export const JOURNAL_ROUTES = ['/', '/onboarding', '/crabby/sheet'];
export const isJournal = (routeId: string | null) => !!routeId && JOURNAL_ROUTES.includes(routeId);
