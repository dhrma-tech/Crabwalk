// CSP violation reports (hardening 2026-11, SEC-10) → one JSON log line each. Reports can carry page URLs with
// share tokens and query strings, so only the directive, the blocked origin and a redacted page path are kept.

/** Long opaque path segments (share tokens, ids) become ':id'; the query string is dropped. */
const redactPath = (u: string) => {
	try {
		return new URL(u).pathname.replace(/\/[A-Za-z0-9_-]{16,}/g, '/:id');
	} catch {
		return null;
	}
};
/** 'inline' / 'eval' / 'data' stay as they are; a URL is cut to its origin. */
const blocked = (u: string) => {
	if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) return u.slice(0, 20) || null;
	try {
		return new URL(u).origin;
	} catch {
		return null;
	}
};

type Fields = { directive: string | null; blocked: string | null; page: string | null };
const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Accepts `application/csp-report` ({"csp-report": {…}}) and `application/reports+json` ([{type, body}]). */
export function parseCspReports(text: string): Fields[] {
	let j: unknown;
	try {
		j = JSON.parse(text.slice(0, 2048));
	} catch {
		return [];
	}
	const one = (r: Record<string, unknown>, legacy: boolean): Fields => ({
		directive:
			str(
				legacy ? (r['effective-directive'] ?? r['violated-directive']) : r.effectiveDirective
			).slice(0, 40) || null,
		blocked: blocked(str(legacy ? r['blocked-uri'] : r.blockedURL)),
		page: redactPath(str(legacy ? r['document-uri'] : r.documentURL))
	});
	if (Array.isArray(j))
		return j
			.slice(0, 5)
			.filter(
				(x) => x && typeof x === 'object' && (x as { type?: string }).type === 'csp-violation'
			)
			.map((x) => one(((x as { body?: object }).body ?? {}) as Record<string, unknown>, false));
	const r = (j as Record<string, unknown> | null)?.['csp-report'];
	return r && typeof r === 'object' ? [one(r as Record<string, unknown>, true)] : [];
}
