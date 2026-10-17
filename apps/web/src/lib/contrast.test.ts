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
// Text tokens on every surface must reach 4.5:1 (normal text, incl. 14 px captions).
const text = ['text', 'text-2', 'text-muted', 'link'];

for (const [name, t] of [
	['light', light],
	['dark', dark]
] as const)
	describe(`${name} theme contrast`, () => {
		for (const fg of text)
			for (const bg of surfaces)
				it(`${fg} on ${bg} ≥ 4.5`, () => expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5));
		it('on-cta on cta ≥ 4.5', () => expect(ratio(t['on-cta'], t.cta)).toBeGreaterThanOrEqual(4.5));
	});

describe('fixed pairs used by components', () => {
	const pairs: [string, string, string][] = [
		['mango text', '#4a2e05', '#e8a33d'],
		['white on sea (selected chip)', '#ffffff', '#0e6e6a'],
		['white on ok badge', '#ffffff', '#2e7d32'],
		['white on danger badge', '#ffffff', '#c62828'],
		['ink on caution badge', '#1e1b16', '#b7791f'],
		['white on emergency', '#ffffff', '#d32f2f'],
		['sea-900 on sea-50 (crowd)', '#05302e', '#ddf3f1'],
		['mango-900 on mango-100 (crowd)', '#4a2e05', '#f8ddaa'],
		['toast sand-100 on sand-900', '#f6efe4', '#1e1b16']
	];
	for (const [label, fg, bg] of pairs)
		it(`${label} ≥ 4.5`, () => expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5));
});
