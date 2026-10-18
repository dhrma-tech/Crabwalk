// Attribution shown wherever tide data is on screen (BACKEND §8; TideCheck terms: near the data, linked).
// Mirrors supabase/functions/_shared/tides.ts.
export const TIDE_ATTRIBUTION = {
	tidecheck: { text: 'Tide data by TideCheck', url: 'https://tidecheck.com' },
	tidesatlas: { text: 'Tide data: TidesAtlas (CC BY 4.0)', url: 'https://tidesatlas.com' }
} as const;

export type TideDay = {
	date: string;
	extremes: { type: 'high' | 'low'; time: string; height_m: number }[];
	provider: keyof typeof TIDE_ATTRIBUTION;
	fetched_at: string;
	attribution: { text: string; url: string };
};

/** Minutes after IST midnight of `date` for an ISO time. */
export const istMinute = (iso: string, date: string) =>
	Math.round((Date.parse(iso) - Date.parse(`${date}T00:00:00+05:30`)) / 60000);

/**
 * Tide height at `minute` (IST) on `date`, cosine-interpolated between that day's extremes (same rule as
 * the planner, DECISIONS P7-4). Null outside the known extremes — unknown is never shown as safe.
 */
export function heightAt(
	extremes: { time: string; height_m: number }[],
	date: string,
	minute: number
) {
	const pts = extremes
		.map((e) => ({ t: istMinute(e.time, date), h: e.height_m }))
		.sort((a, b) => a.t - b.t);
	for (let i = 0; i < pts.length - 1; i++) {
		const a = pts[i]!;
		const b = pts[i + 1]!;
		if (minute >= a.t && minute <= b.t)
			return a.h + ((b.h - a.h) * (1 - Math.cos((Math.PI * (minute - a.t)) / (b.t - a.t)))) / 2;
	}
	return null;
}

/** Accessible / cut off / unknown at a given minute for a place with a max safe height. */
export function tideState(
	extremes: { time: string; height_m: number }[] | null,
	maxSafe: number | null,
	date: string,
	minute: number
): 'ok' | 'cut' | 'unknown' {
	if (maxSafe == null || !extremes?.length) return 'unknown';
	const h = heightAt(extremes, date, minute);
	return h == null ? 'unknown' : h <= maxSafe ? 'ok' : 'cut';
}
