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
