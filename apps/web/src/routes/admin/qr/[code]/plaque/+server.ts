import { error } from '@sveltejs/kit';
import { encode } from 'uqr';
import { m } from '#lib/paraglide/messages.js';
import { esc } from '#lib/qr/page.ts';
import { requireStaff } from '#lib/server/auth.ts';
import { CODE_RE } from '#lib/server/qr.ts';
import { names } from '#lib/server/listings.ts';
import type { RequestHandler } from './$types';

// Plaque sheet (BACKEND §9): printable A5 SVG — place name, QR → short URL, "112", short URL text.
// Print at 100 % from the browser. Text in English + Marathi.
export const GET: RequestHandler = async (event) => {
	await requireStaff(event, 'admin');
	const code = event.params.code;
	if (!CODE_RE.test(code)) error(404, 'not found');
	const db = event.locals.supabase;
	const { data: q } = await db
		.from('qr_codes')
		.select('entity_type, entity_id')
		.eq('code', code)
		.maybeSingle();
	if (!q) error(404, 'not found');

	let name: { en: string; mr: string | null };
	if (q.entity_type === 'station' || q.entity_type === 'bus_stand') {
		const { data } = await db.from('utility_pois').select('name').eq('id', q.entity_id).single();
		name = { en: data?.name ?? code, mr: null };
	} else {
		const t = `${q.entity_type}_translations` as const;
		const table = { place: 'places', stay: 'stays', eatery: 'eateries' }[q.entity_type];
		const { data } = await db
			.from(table as 'places')
			.select(`${t}(lang, name)`)
			.eq('id', q.entity_id)
			.single();
		const n = names((data as Record<string, { lang: string; name: string }[]> | null)?.[t]);
		name = { en: n.en || code, mr: n.mr };
	}

	const url = `${event.url.origin}/q/${code}`;
	const qr = encode(url, { ecc: 'Q', border: 0 });
	const side = 96; // mm
	const cell = side / qr.size;
	const x0 = (148 - side) / 2;
	const y0 = 54;
	let path = '';
	qr.data.forEach((row, y) =>
		row.forEach((on, x) => {
			if (on)
				path += `M${(x0 + x * cell).toFixed(3)} ${(y0 + y * cell).toFixed(3)}h${cell.toFixed(3)}v${cell.toFixed(3)}h-${cell.toFixed(3)}z`;
		})
	);
	const mr = { locale: 'mr' as const };
	const font = `font-family="system-ui, 'Noto Sans Devanagari', sans-serif"`;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="148mm" height="210mm" viewBox="0 0 148 210" ${font}>
<rect width="148" height="210" fill="#fff"/>
<rect x="4" y="4" width="140" height="202" rx="6" fill="none" stroke="#B5462B" stroke-width="1.2"/>
<text x="74" y="20" text-anchor="middle" font-size="10" font-weight="700" fill="#1E1B16">${esc(name.en)}</text>
${name.mr ? `<text x="74" y="32" text-anchor="middle" font-size="8.5" fill="#1E1B16">${esc(name.mr)}</text>` : ''}
<text x="74" y="40" text-anchor="middle" font-size="4.2" fill="#5A4A35">${esc(m.qr_plaque_scan({}, { locale: 'en' }))}</text>
<text x="74" y="46" text-anchor="middle" font-size="4.2" fill="#5A4A35">${esc(m.qr_plaque_scan({}, mr))}</text>
<path d="${path}" fill="#000"/>
<text x="74" y="${y0 + side + 10}" text-anchor="middle" font-size="6" font-family="ui-monospace, monospace" fill="#1E1B16">${esc(url.replace(/^https?:\/\//, ''))}</text>
<rect x="14" y="172" width="120" height="24" rx="12" fill="#D32F2F"/>
<text x="74" y="188.5" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">${esc(m.qr_emergency({}, { locale: 'en' }))} 112 · ${esc(m.qr_emergency({}, mr))}</text>
</svg>`;
	return new Response(svg, {
		headers: {
			'Content-Type': 'image/svg+xml; charset=utf-8',
			'Content-Disposition': `inline; filename="plaque-${code}.svg"`,
			'Cache-Control': 'private, no-store'
		}
	});
};
