import { listItineraries } from '#lib/server/planner/itineraries.ts';
import type { RequestHandler } from './$types';

// Public, indexable pages: the browse pages plus every published listing (RLS + status filter). Private and
// token pages are kept out by robots.txt and X-Robots-Tag (hooks.server.ts).
const STATIC = [
	'/',
	'/map',
	'/stays',
	'/food',
	'/taste-konkan',
	'/itineraries',
	'/start',
	'/privacy'
];

const esc = (s: string) =>
	s.replace(
		/[&<>'"]/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;' })[c]!
	);

export const GET: RequestHandler = async ({ url, locals }) => {
	const db = locals.supabase;
	const [places, stays, eateries, dishes, itineraries] = await Promise.all([
		db.from('places').select('slug, updated_at').eq('status', 'published').limit(5000),
		db.from('stays').select('slug, updated_at').eq('status', 'published').limit(5000),
		db.from('eateries').select('slug, updated_at').eq('status', 'published').limit(5000),
		db.from('dishes').select('slug, updated_at').limit(5000),
		listItineraries(db, 'en', 500)
	]);
	const rows: [string, string | null][] = [
		...STATIC.map((p) => [p, null] as [string, null]),
		...(places.data ?? []).map((r) => [`/place/${r.slug}`, r.updated_at] as [string, string]),
		...(stays.data ?? []).map((r) => [`/stays/${r.slug}`, r.updated_at] as [string, string]),
		...(eateries.data ?? []).map((r) => [`/food/${r.slug}`, r.updated_at] as [string, string]),
		...(dishes.data ?? []).map(
			(r) => [`/taste-konkan/${r.slug}`, r.updated_at] as [string, string]
		),
		...itineraries.map((i) => [i.href, null] as [string, null])
	];
	const body =
		'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
		rows
			.map(
				([path, mod]) =>
					`<url><loc>${esc(url.origin + path)}</loc>${mod ? `<lastmod>${mod.slice(0, 10)}</lastmod>` : ''}</url>`
			)
			.join('\n') +
		'\n</urlset>\n';
	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
