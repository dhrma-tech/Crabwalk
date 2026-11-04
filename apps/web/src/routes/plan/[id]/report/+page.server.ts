import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocale } from '#lib/paraglide/runtime.js';
import { session } from '#lib/server/auth.ts';
import type { Lang } from '#lib/server/listings.ts';
import { buildReport, reportSummary, type Report } from '#lib/server/report.ts';
import { loadProfile } from '#lib/server/profile.ts';
import { postMessage } from '#lib/server/chat/trip-chat.ts';
import type { Actions, PageServerLoad } from './$types';

// Trip report (P12 step H, product plan 10.12): the live report, always current with the plan; ?v=N shows a
// finalized version. Editors finalize a version (adds Crabby's short summary, posts it to the group chat).
export const load: PageServerLoad = async (event) => {
	const s = await session(event);
	const id = z.uuid().safeParse(event.params.id);
	if (!id.success) error(404, 'not found');
	const db = event.locals.supabase;
	const lang = getLocale() as Lang;
	const { data: trip } = await db
		.from('trips')
		.select('id, owner_id, share_token')
		.eq('id', id.data)
		.maybeSingle();
	if (!trip) error(404, 'not found');
	const { data: me } = await db
		.from('trip_members')
		.select('role')
		.eq('trip_id', trip.id)
		.eq('user_id', s.user.id)
		.maybeSingle();
	const role = trip.owner_id === s.user.id ? 'owner' : (me?.role ?? null);
	const { data: versions } = await db
		.from('trip_reports')
		.select('version, created_at')
		.eq('trip_id', trip.id)
		.eq('lang', lang)
		.order('version', { ascending: false });
	const v = Number(event.url.searchParams.get('v')) || null;
	let report: Report | null;
	let summary: string | null = null;
	if (v) {
		const { data } = await db
			.from('trip_reports')
			.select('payload, summary')
			.eq('trip_id', trip.id)
			.eq('lang', lang)
			.eq('version', v)
			.maybeSingle();
		if (!data) error(404, 'not found');
		report = data.payload as unknown as Report;
		summary = data.summary;
	} else report = await buildReport(db, trip.id, lang);
	if (!report) error(404, 'not found');
	return {
		tripId: trip.id,
		report,
		summary,
		version: v,
		versions: versions ?? [],
		canFinalize: role === 'owner' || role === 'editor',
		shareToken: trip.share_token
	};
};

export const actions: Actions = {
	finalize: async (event) => {
		const s = await session(event);
		const db = event.locals.supabase;
		const lang = getLocale() as Lang;
		const tripId = event.params.id;
		const report = await buildReport(db, tripId, lang);
		if (!report) return fail(404);
		const persona = (await loadProfile(db, s.user.id))?.persona ?? 'playful';
		const summary = await reportSummary(db, report, lang, persona);
		const { data: last } = await db
			.from('trip_reports')
			.select('version')
			.eq('trip_id', tripId)
			.eq('lang', lang)
			.order('version', { ascending: false })
			.limit(1)
			.maybeSingle();
		const version = (last?.version ?? 0) + 1;
		const { error: e } = await db.from('trip_reports').insert({
			trip_id: tripId,
			version,
			lang,
			payload: report as never,
			summary,
			created_by: s.user.id
		});
		if (e) return fail(403);
		// Shared with the whole group (10.12); a trip without a chat member row just skips this.
		await postMessage(db, tripId, {
			kind: 'report',
			body: report.cover.title,
			payload: { version, href: `/plan/${tripId}/report?v=${version}` }
		}).catch(() => {});
		redirect(303, `/plan/${tripId}/report?v=${version}`);
	}
};
