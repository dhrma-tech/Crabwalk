// Daily (pg_cron, 06:00 IST): next 7 days of tide extremes per tide_station → tide_cache.
// Provider via TIDE_PROVIDER (default tidecheck — DECISIONS P3-1). TideCheck terms allow caching ≤ 24 h,
// so rows not refreshed within 24 h are deleted (better "unknown" than stale safety data).
import { admin, authorized, json } from '../_shared/cron.ts';
import { byDate, fetchExtremes, type Provider, type Station } from '../_shared/tides.ts';

const DAYS = 7;

Deno.serve(async (req) => {
	if (!authorized(req)) return json({ error: 'unauthorized' }, 401);
	const provider = (Deno.env.get('TIDE_PROVIDER') ?? 'tidecheck') as Provider;
	const key = Deno.env.get(provider === 'tidecheck' ? 'TIDECHECK_API_KEY' : 'TIDESATLAS_API_KEY');
	if (!key) return json({ error: `API key for ${provider} not set` }, 500);

	const db = admin();
	const { data: stations, error } = await db.rpc('tide_station_coords');
	if (error) return json({ error: error.message }, 500);

	let written = 0;
	const failed: string[] = [];
	for (const s of stations as Station[]) {
		try {
			const days = byDate(await fetchExtremes(provider, s, DAYS, key));
			const rows = [...days].map(([date, extremes]) => ({
				station_id: s.id,
				date,
				extremes,
				curve: null,
				provider,
				fetched_at: new Date().toISOString()
			}));
			const { error: upErr } = await db.from('tide_cache').upsert(rows, { onConflict: 'station_id,date' });
			if (upErr) throw new Error(upErr.message);
			written += rows.length;
		} catch (e) {
			failed.push(`${s.provider_station_id}: ${(e as Error).message}`);
		}
	}
	const { count: expired } = await db
		.from('tide_cache')
		.delete({ count: 'exact' })
		.lt('fetched_at', new Date(Date.now() - 24 * 3600e3).toISOString());
	return json({ provider, written, expired, failed });
});
