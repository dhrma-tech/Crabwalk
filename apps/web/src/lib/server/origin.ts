// The permanent address printed on QR plaques (hardening 2026-11, SEC-14). A plaque outlives any deployment, so
// it must carry the site's own domain, never the host that happened to serve the admin page (a pages.dev
// preview, localhost or an IP). PUBLIC_ORIGIN is set by the owner once the domain is chosen (M4).

export type PlaqueOrigin = { ok: true; origin: string; host: string } | { ok: false };

/** An https origin on a real domain, or not ok: unset, not a URL, http, *.pages.dev, localhost or an IP. */
export function plaqueOrigin(raw: string | undefined): PlaqueOrigin {
	let u: URL;
	try {
		u = new URL(raw ?? '');
	} catch {
		return { ok: false };
	}
	const h = u.hostname.toLowerCase();
	if (
		u.protocol !== 'https:' ||
		h === 'localhost' ||
		h.endsWith('.localhost') ||
		h.endsWith('.pages.dev') ||
		/^\d{1,3}(\.\d{1,3}){3}$/.test(h) ||
		h.startsWith('[') ||
		!h.includes('.')
	)
		return { ok: false };
	return { ok: true, origin: u.origin, host: u.host };
}
