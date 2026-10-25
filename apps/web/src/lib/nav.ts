// Which nav item is current: Discover only on "/", every other item for its first path segment, so the Plan item
// (/plan/new) stays current on /plan/:id and the vote page.
export function isActive(path: string, href: string) {
	if (href === '/') return path === '/';
	const base = href.split('/').slice(0, 2).join('/');
	return path === base || path.startsWith(`${base}/`);
}
