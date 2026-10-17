import { z } from 'zod';
import { Constants } from '#lib/db.types.ts';

const csv = <const T extends readonly [string, ...string[]]>(values: T) =>
	z
		.string()
		.optional()
		.transform((s) => (s ? s.split(',').filter(Boolean) : undefined))
		.pipe(z.array(z.enum(values)).max(20).optional());

// bbox = minLon,minLat,maxLon,maxLat (WGS84); capped to a sane area so one request can't scan everything.
export const bbox = z
	.string()
	.transform((s) => s.split(',').map(Number))
	.pipe(
		z
			.tuple([
				z.number().min(-180).max(180),
				z.number().min(-90).max(90),
				z.number().min(-180).max(180),
				z.number().min(-90).max(90)
			])
			.refine(([x0, y0, x1, y1]) => x1 > x0 && y1 > y0 && x1 - x0 <= 5 && y1 - y0 <= 5, 'bbox')
	);

export const pinsQuery = z.object({
	bbox,
	kinds: csv(['place', 'stay', 'eatery']),
	categories: csv(Constants.public.Enums.place_category),
	open_now: z.enum(['0', '1']).optional()
});

export const utilitiesQuery = z.object({
	bbox,
	types: z
		.string()
		.transform((s) => s.split(',').filter(Boolean))
		.pipe(z.array(z.enum(Constants.public.Enums.utility_type)).min(1).max(20))
});

export const toFeatures = <T extends { lon: number; lat: number }>(rows: T[]) => ({
	type: 'FeatureCollection' as const,
	features: rows.map(({ lon, lat, ...properties }) => ({
		type: 'Feature' as const,
		geometry: { type: 'Point' as const, coordinates: [lon, lat] },
		properties
	}))
});
