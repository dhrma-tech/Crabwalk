import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// FRONTEND §12: WCAG 2.2 AA, the pairs of Report 2 §3.4 (T-1). Reads the tokens straight from app.css so a
// token change is re-checked. Text ≥ 4.5; UI parts and graphics (borders, dots, bars, icons, pins) ≥ 3.
const css = readFileSync(new URL('../app.css', import.meta.url), 'utf8');
const block = (selector: string) => {
	const body = css.slice(css.indexOf(selector)).match(/\{([^}]*)\}/)![1];
	return Object.fromEntries(
		[...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]])
	);
};
const light = block(':root {');
const darkOverrides = block(":root[data-theme='dark'] {");
const dark = { ...light, ...darkOverrides };

const lum = (hex: string) => {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const v = parseInt(hex.slice(i, i + 2), 16) / 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
	const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
	return (x + 0.05) / (y + 0.05);
};

it('system dark and the manual dark theme use the same values', () =>
	expect(block(":root:not([data-theme='light']) {")).toEqual(darkOverrides));

const surfaces = ['bg', 'surface', 'surface-2'];
// [foreground, background] pairs; "white" is a literal.
const text: [string, string][] = [
	...['text', 'text-2', 'text-muted', 'lagoon', 'kokum'].flatMap((fg) =>
		surfaces.map((bg) => [fg, bg] as [string, string])
	),
	...['ok', 'caution', 'danger'].map((fg) => [fg, 'bg'] as [string, string]),
	['on-kokum', 'kokum'],
	['on-kokum', 'kokum-hover'],
	['on-alphonso', 'alphonso'],
	['kokum-ink', 'kokum-50'],
	['lagoon-ink', 'lagoon-50'],
	['alphonso-ink', 'alphonso-50'],
	// Toasts and selected chips invert ink and paper.
	['bg', 'text'],
	['surface', 'text'],
	// Ink on every tint (badges, banners, bubbles, category tiles, do/don't cards).
	...[
		'kokum-50',
		'kokum-100',
		'lagoon-50',
		'lagoon-100',
		'alphonso-50',
		'laterite-50',
		'ok-50',
		'caution-50',
		'danger-50'
	].map((bg) => ['text', bg] as [string, string]),
	['white', 'emergency'],
	['white', 'emergency-hover']
];
const graphics: [string, string][] = [
	['border-strong', 'bg'],
	['border-strong', 'surface'],
	['focus', 'bg'],
	['focus', 'surface'],
	// Verdict bars sit on cards and the page.
	...['v1', 'v2', 'v3', 'v4'].flatMap((v) => [
		[v, 'bg'] as [string, string],
		[v, 'surface'] as [string, string]
	]),
	// Status dots carry an ink label (StatusBadge on surface-2).
	...['ok', 'caution', 'danger', 'lagoon'].flatMap((dot) =>
		['bg', 'surface-2'].map((bg) => [dot, bg] as [string, string])
	),
	// Category icons in their family tint (Report 2 §3.3; land family uses alphonso-ink, T-19).
	['lagoon', 'lagoon-50'],
	['laterite', 'laterite-50'],
	['alphonso-ink', 'alphonso-50'],
	// Pin glyphs (Report 2 §10): places kokum, stays lagoon, food alphonso.
	['on-kokum', 'kokum'],
	['on-lagoon', 'lagoon'],
	['on-alphonso', 'alphonso']
];

for (const [name, t] of [
	['light', light],
	['dark', dark]
] as const) {
	const hex = (k: string) => (k === 'white' ? '#ffffff' : t[k]);
	describe(`${name} theme contrast`, () => {
		for (const [fg, bg] of text)
			it(`${fg} on ${bg} ≥ 4.5`, () => expect(ratio(hex(fg), hex(bg))).toBeGreaterThanOrEqual(4.5));
		for (const [fg, bg] of graphics)
			it(`${fg} on ${bg} ≥ 3`, () => expect(ratio(hex(fg), hex(bg))).toBeGreaterThanOrEqual(3));
	});
}

describe('fixed pairs used by components', () => {
	// The QR page carries its own inline CSS (P6-9); restyled to Tideline in step E.
	it('QR page ink on washi ≥ 4.5', () =>
		expect(ratio('#1f1e1c', '#f4f0e8')).toBeGreaterThanOrEqual(4.5));
	// Map pins until step E moves them to the Tideline pin colours (PIN in map/style.ts, glyphs in map/icons.ts).
	const pins: [string, string, string][] = [
		['ink glyph on place pin', '#1f1e1c', '#d99a00'],
		['white glyph on stay pin', '#ffffff', '#00808a'],
		['white glyph on food pin', '#ffffff', '#c45a78'],
		['white glyph on utility pin', '#ffffff', '#5c584f'],
		['washi count on cluster', '#f4f0e8', '#6c6ba8']
	];
	for (const [label, fg, bg] of pins)
		it(`${label} ≥ 3`, () => expect(ratio(fg, bg)).toBeGreaterThanOrEqual(3));
});
