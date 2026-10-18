import { describe, expect, it } from 'vitest';
import type { QrData } from '#lib/server/qr.ts';
import { renderQrMissing, renderQrPage } from './page.ts';

// PLAN P6 acceptance / FRONTEND §11: scan page < 100 KB total, no webfonts, no framework.
// The only other transfer is the 480 px hero (WebP); the HTML budget leaves ≥ 60 KB for it.
const HTML_BUDGET = 40_000;
const bytes = (s: string) => new TextEncoder().encode(s).length;
const deva = (n: number) => 'कोकणातील किल्ला '.repeat(Math.ceil(n / 16)).slice(0, n);
const time = (iso: string) => iso.slice(11, 16);

const base: QrData = {
	code: 'RTN-001',
	kind: 'place',
	name: 'जयगड किल्ला',
	altName: 'Jaigad Fort',
	href: '/place/jaigad-fort',
	photo: {
		src: 'https://x.supabase.co/storage/v1/object/public/photos/place/1/a-480.webp',
		alt: 'Fort'
	},
	audio: { src: 'https://x.supabase.co/a.mp3', transcript: deva(3000) },
	story: deva(4000) + '<script>alert(1)</script>',
	dos: deva(1000),
	donts: deva(1000),
	safety: {
		monsoon: 'risky',
		monsoonReason: deva(200),
		text: deva(1000),
		tideDependent: true,
		tide: {
			extremes: [
				{ type: 'high', time: '2026-10-18T04:12:00Z', height_m: 1.84 },
				{ type: 'low', time: '2026-10-18T10:30:00Z', height_m: 0.41 }
			],
			attribution: { text: 'Tide data by TideCheck', url: 'https://tidecheck.com' }
		}
	},
	menu: [],
	verdict: null,
	reviews: [],
	near: Array.from({ length: 13 }, (_, i) => ({
		kind: i < 4 ? ('utility' as const) : ('place' as const),
		sub: i < 4 ? 'hospital' : null,
		href: i < 4 ? null : `/place/spot-${i}`,
		name: deva(40),
		distance_m: 350 * i,
		minutes: i < 4 ? null : 12,
		phone: i < 4 ? '02352 222222' : null
	})),
	sponsor: 'Sea View Homestay',
	coords: [73.2, 17.29]
};

describe('QR scan page', () => {
	const html = renderQrPage(base, { lang: 'mr', reported: false, time });

	it('fits the size budget with long Devanagari content', () => {
		expect(bytes(html)).toBeLessThan(HTML_BUDGET);
	});

	it('uses no webfonts, external CSS/JS or framework', () => {
		expect(html).not.toMatch(/@font-face|<link\b|<script[^>]*\bsrc=|\.woff2?|data-sveltekit/);
		const js = html.match(/<script>([\s\S]*?)<\/script>/g) ?? [];
		expect(js).toHaveLength(1);
		expect(bytes(js[0] ?? '')).toBeLessThan(3000);
		expect(html).toContain('system-ui,"Noto Sans Devanagari",sans-serif');
	});

	it('keeps the locked section order with the emergency bar last', () => {
		const at = (s: string) => html.indexOf(s);
		const order = [
			'class="hero"',
			'<audio',
			deva(20),
			'class="st-risky"',
			'class="near"',
			'class="sponsor"',
			'href="tel:112"'
		].map(at);
		expect(order.every((i) => i >= 0)).toBe(true);
		expect([...order].sort((a, b) => a - b)).toEqual(order);
	});

	it('escapes listing content', () => {
		expect(html).not.toContain('<script>alert(1)');
		expect(html).toContain('&lt;script&gt;alert(1)');
	});

	it('works without JS: tel:112, report form and language switch are plain HTML', () => {
		expect(html).toContain('<a href="tel:112">');
		expect(html).toMatch(/<form method="post" action="\/q\/RTN-001\/report"/);
		expect(html).toMatch(/<form method="post" action="\/prefs"/);
		// GPS-only controls are hidden until the script reveals them.
		expect(html).toMatch(/id="share" data-js hidden/);
	});

	it('eatery page: menu capped, reviews + leave-review link, still in budget', () => {
		const e = renderQrPage(
			{
				...base,
				kind: 'eatery',
				href: '/food/x',
				audio: null,
				menu: Array.from({ length: 100 }, () => deva(200)),
				verdict: { level: 4, pct: 0.62, total: 40, isNew: false },
				reviews: Array.from({ length: 3 }, () => ({ text: deva(1000), date: '2026-10-01' }))
			},
			{ lang: 'en', reported: false, time }
		);
		expect((e.match(/<li>/g) ?? []).length).toBeLessThanOrEqual(30 + 13 + 3);
		expect(e).toContain('href="/food/x"');
		expect(e).toContain('62% say Local legend');
		expect(bytes(e)).toBeLessThan(HTML_BUDGET);
	});

	it('unknown code still offers 112', () => {
		expect(renderQrMissing('en')).toContain('href="tel:112"');
	});
});
