// Hourly (pg_cron): OpenWeatherMap Current Weather 2.5 (free, card-free — DECISIONS A7) for each weather_point.
// ~20 points × 24 = ~480 calls/day (budget ~1,000). Keeps 7 days of history (DECISIONS P3-5).
// Docs: https://openweathermap.org/current  GET /data/2.5/weather?lat&lon&appid&units=metric
import { admin, authorized, json } from '../_shared/cron.ts';

const KEEP_DAYS = 7;

Deno.serve(async (req) => {
	if (!authorized(req)) return json({ error: 'unauthorized' }, 401);
	const key = Deno.env.get('OPENWEATHER_API_KEY');
	if (!key) return json({ error: 'OPENWEATHER_API_KEY not set' }, 500);

	const db = admin();
	const { data: points, error } = await db.rpc('weather_point_coords');
	if (error) return json({ error: error.message }, 500);

	const rows = [];
	const failed: string[] = [];
	for (const p of points as { id: string; name: string; lon: number; lat: number }[]) {
		const url = `https://api.openweathermap.org/data/2.5/weather?lat=${p.lat}&lon=${p.lon}&units=metric&appid=${key}`;
		try {
			const res = await fetch(url);
			if (!res.ok) {
				failed.push(`${p.name}: ${res.status}`);
				if (res.status === 429 || res.status === 401) break; // quota or bad key: stop, retry next hour
				continue;
			}
			const w = await res.json();
			rows.push({
				point_id: p.id,
				payload: w,
				summary: {
					temp_c: w.main?.temp ?? null,
					rain_1h_mm: w.rain?.['1h'] ?? 0,
					wind_ms: w.wind?.speed ?? null,
					condition: w.weather?.[0]?.main ?? null,
					description: w.weather?.[0]?.description ?? null,
					observed_at: w.dt ? new Date(w.dt * 1000).toISOString() : null
				}
			});
		} catch (e) {
			failed.push(`${p.name}: ${(e as Error).message}`);
		}
	}
	if (rows.length) {
		const { error: insErr } = await db.from('weather_cache').insert(rows);
		if (insErr) return json({ error: insErr.message }, 500);
	}
	await db.from('weather_cache').delete().lt('fetched_at', new Date(Date.now() - KEEP_DAYS * 864e5).toISOString());
	return json({ written: rows.length, failed });
});
