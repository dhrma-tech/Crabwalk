import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// FRONTEND §12: WCAG 2.2 AA. Reads the tokens straight from app.css so a token change is re-checked.
const css = readFileSync(new URL('../app.css', import.meta.url), 'utf8');
const block = (selector: string) => {
	const body = css.slice(css.indexOf(selector)).match(/\{([^}]*)\}/)![1];
	return Object.fromEntries(
		[...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]])
	);
};
const light = block(':root {');
const dark = { ...light, ...block(":root[data-theme='dark'] {") };

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

const surfaces = ['bg', 'surface', 'surface-raised'];
// Text tokens on every surface must reach 4.5:1 (normal text, incl. 13 px captions).
const text = ['text', 'text-2', 'text-muted', 'link', 'ok', 'caution'];
// Suna tints carry ink text (badges, banners, chat bubbles, category tiles).
const tints = ['sakura', 'asagi', 'yama', 'wakaba', 'fuji'];

for (const [name, t] of [
	['light', light],
	['dark', dark]
] as const)
	describe(`${name} theme contrast`, () => {
		for (const fg of text)
			for (const bg of surfaces)
				it(`${fg} on ${bg} ≥ 4.5`, () => expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5));
		it('on-cta on cta ≥ 4.5', () => expect(ratio(t['on-cta'], t.cta)).toBeGreaterThanOrEqual(4.5));
		// Selected chips / segments and toasts invert ink and paper.
		it('bg on text ≥ 4.5', () => expect(ratio(t.bg, t.text)).toBeGreaterThanOrEqual(4.5));
		for (const tint of tints)
			it(`text on ${tint} ≥ 4.5`, () => expect(ratio(t.text, t[tint])).toBeGreaterThanOrEqual(4.5));
		// Status dots are graphics: 3:1 against the page (WCAG 1.4.11); their words carry the meaning.
		for (const dot of ['ok', 'caution', 'danger'])
			it(`${dot} dot on bg ≥ 3`, () => expect(ratio(t[dot], t.bg)).toBeGreaterThanOrEqual(3));
	});

describe('fixed pairs used by components', () => {
	const pairs: [string, string, string][] = [
		['white on emergency', '#ffffff', '#b3261e'],
		['QR page ink on washi', '#1f1e1c', '#f4f0e8']
	];
	for (const [label, fg, bg] of pairs)
		it(`${label} ≥ 4.5`, () => expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5));
	// Map pin glyphs are graphics (3:1): PIN in map/style.ts, glyph colours in map/icons.ts.
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
