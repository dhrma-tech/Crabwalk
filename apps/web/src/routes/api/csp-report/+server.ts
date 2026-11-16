import { parseCspReports } from '#lib/server/cspReport.ts';
import { securityEvent } from '#lib/server/log.ts';
import type { RequestHandler } from './$types';

// POST /api/csp-report (SEC-10): browsers report CSP violations here (`report-uri` in vite.config.ts). One JSON
// log line per report, nothing stored, always 204. Rate rule `csp-report` in lib/server/rate.ts.
export const POST: RequestHandler = async (event) => {
	const { request } = event;
	const type = request.headers.get('content-type') ?? '';
	if (/application\/(csp-report|reports\+json|json)/.test(type)) {
		const text = (await request.text().catch(() => '')).slice(0, 2048);
		for (const r of parseCspReports(text)) await securityEvent('csp_report', r, event);
	}
	return new Response(null, { status: 204 });
};
