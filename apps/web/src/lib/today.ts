import type { TIDE_ATTRIBUTION } from '#lib/tides.ts';

// "Today on the coast" (Discover, DECISIONS T-9/T-24): cached weather + tides only, picked on the device so the
// visitor's position never leaves it. Missing or stale data is dropped, never guessed.

export type WeatherPoint = {
	id: string;
	name: string;
	lon: number;
	lat: number;
	temp_c: number | null;
	condition: string | null;
	observed_at: string;
};
export type TideStation = {
	name: string;
	lon: number;
	lat: number;
	low: { time: string; height_m: number };
	provider: keyof typeof TIDE_ATTRIBUTION;
};

/** Weather older than this is not shown (same window as Crabby's get_conditions). */
export const WEATHER_MAX_AGE_MS = 3 * 3600e3;

export const WEATHER_ATTRIBUTION = {
	text: 'OpenWeather',
	url: 'https://openweathermap.org'
} as const;

/** OWM `weather[0].main` → message key suffix; anything else shows the temperature only. */
const CONDITIONS: Record<string, string> = {
	Clear: 'clear',
	Clouds: 'clouds',
	Rain: 'rain',
	Drizzle: 'drizzle',
	Thunderstorm: 'storm',
	Squall: 'storm',
	Mist: 'haze',
	Haze: 'haze',
	Fog: 'haze',
	Smoke: 'haze',
	Dust: 'haze'
};
export const conditionKey = (c: string | null) =>
	c && CONDITIONS[c] ? `wx_${CONDITIONS[c]}` : null;

/** Nearest item by equirectangular distance (fine at coast scale). */
export function nearest<T extends { lon: number; lat: number }>(
	items: T[],
	lon: number,
	lat: number
) {
	const k = Math.cos((lat * Math.PI) / 180);
	let best: T | undefined;
	let bestD = Infinity;
	for (const it of items) {
		const d = ((it.lon - lon) * k) ** 2 + (it.lat - lat) ** 2;
		if (d < bestD) [best, bestD] = [it, d];
	}
	return best;
}

/** First low tide at or after `now` among the given extremes (any days), or null. */
export function nextLow(
	extremes: { type: string; time: string; height_m: number }[],
	now = Date.now()
): { time: string; height_m: number } | null {
	const lows = extremes
		.filter((e) => e.type === 'low' && Date.parse(e.time) >= now)
		.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
	return lows[0] ? { time: lows[0].time, height_m: lows[0].height_m } : null;
}

export type TodayData = {
	points: WeatherPoint[];
	stations: TideStation[];
	/** The region's default weather point; its place decides the tide station even when its weather is stale. */
	defaultPoint: { id: string; lon: number; lat: number } | null;
};

/** The strip's weather point and its nearest tide station: near `here` if given, else the region default. */
export function pickToday(data: TodayData, here: { lon: number; lat: number } | null) {
	const point = here
		? nearest(data.points, here.lon, here.lat)
		: data.points.find((p) => p.id === data.defaultPoint?.id);
	const from = here ?? data.defaultPoint;
	const tide = from ? nearest(data.stations, from.lon, from.lat) : undefined;
	return { weather: point ?? null, tide: tide ?? null };
}
