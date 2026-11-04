import { error } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import type { Report } from '#lib/server/report.ts';
import type { PageServerLoad } from './$types';

// /plan/share/:token/report — the latest finalized trip report for anyone with the trip's read-only link
// (P12 step H). Tripmates appear as a count only; nobody is named.
export const load: PageServerLoad = async ({ locals, params }) => {
	const { data } = await locals.supabase.rpc('trip_report_by_token', {
		_token: params.token,
		_lang: getLocale() as 'en' | 'hi' | 'mr'
	});
	const r = data?.[0];
	if (!r) error(404, 'not found');
	return { report: r.payload as unknown as Report, summary: r.summary, version: r.version };
};
