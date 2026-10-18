import { error } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const esc = (s: string) =>
	s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);

// GET /api/trails/:id/gpx — GPX 1.1 from the stored geometry (FRONTEND §8: trails layer + GPX download).
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!z.uuid().safeParse(params.id).success) error(404, 'not found');
	const { data } = await locals.supabase.rpc('trail_geojson', { _id: params.id });
	const t = data?.[0];
	if (!t) error(404, 'not found');
	const coords = (JSON.parse(t.geojson) as { coordinates: [number, number][] }).coordinates;
	const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Crabwalk" xmlns="http://www.topografix.com/GPX/1/1">
<metadata><name>${esc(t.name_en)}</name><copyright author="OpenStreetMap contributors"><license>https://opendatacommons.org/licenses/odbl/</license></copyright></metadata>
<trk><name>${esc(t.name_en)}</name><trkseg>
${coords.map(([lon, lat]) => `<trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"/>`).join('\n')}
</trkseg></trk>
</gpx>
`;
	return new Response(gpx, {
		headers: {
			'Content-Type': 'application/gpx+xml',
			'Content-Disposition': `attachment; filename="${t.name_en.replace(/[^\w-]+/g, '_')}.gpx"`,
			'Cache-Control': 'public, max-age=86400'
		}
	});
};
