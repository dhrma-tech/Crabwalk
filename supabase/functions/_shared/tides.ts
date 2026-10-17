// Tide provider adapters behind TIDE_PROVIDER (BACKEND §8). Both normalise to per-IST-date extremes.
// TideCheck  docs https://tidecheck.com/developers  GET /api/station/:id/tides?days&datum  (X-API-Key)
// TidesAtlas docs https://tidesatlas.com/en/api/docs GET /api/v1/tides?lat&lon&days     (X-API-Key)
export type Provider = 'tidecheck' | 'tidesatlas';
export type Extreme = { type: 'high' | 'low'; time: string; height_m: number };
export type Station = { id: string; provider_station_id: string; lon: number; lat: number };

export const ATTRIBUTION: Record<Provider, { text: string; url: string }> = {
	tidecheck: { text: 'Tide data by TideCheck', url: 'https://tidecheck.com' },
	tidesatlas: { text: 'Tide data: TidesAtlas (CC BY 4.0)', url: 'https://tidesatlas.com' }
};

const istDate = (iso: string) =>
	new Date(new Date(iso).getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);

/** Group extremes by IST calendar date. */
export function byDate(extremes: Extreme[]) {
	const out = new Map<string, Extreme[]>();
	for (const e of extremes) (out.get(istDate(e.time)) ?? out.set(istDate(e.time), []).get(istDate(e.time))!).push(e);
	return out;
}

export async function fetchExtremes(provider: Provider, s: Station, days: number, key: string): Promise<Extreme[]> {
	if (provider === 'tidecheck') {
		const res = await fetch(`https://tidecheck.com/api/station/${encodeURIComponent(s.provider_station_id)}/tides?days=${days}&datum=LAT`, {
			headers: { 'X-API-Key': key }
		});
		if (!res.ok) throw new Error(`tidecheck ${res.status}`);
		const body = (await res.json()) as { extremes: { type: string; time: string; height: number }[] };
		return body.extremes.map((e) => ({ type: e.type as Extreme['type'], time: e.time, height_m: e.height }));
	}
	const res = await fetch(`https://tidesatlas.com/api/v1/tides?lat=${s.lat}&lon=${s.lon}&days=${days}`, {
		headers: { 'X-API-Key': key }
	});
	if (!res.ok) throw new Error(`tidesatlas ${res.status}`);
	const body = (await res.json()) as { extremes: { type: string; datetime: string; height_m: number }[] };
	return body.extremes.map((e) => ({ type: e.type as Extreme['type'], time: e.datetime, height_m: e.height_m }));
}
