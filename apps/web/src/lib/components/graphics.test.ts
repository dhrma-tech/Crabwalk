import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Illustration from './Illustration.svelte';
import NoPhoto from './NoPhoto.svelte';
import { renderQrMissing } from '#lib/qr/page.ts';

// Hardening T1-07 (brief section 4.9): every new graphic under its size cap, decorative, tokens only.
const svg = (html: string) => {
	const s = html.replace(/<!--[^>]*-->/g, '').match(/<svg[\s\S]*?<\/svg>/)?.[0] ?? '';
	return { s, bytes: new TextEncoder().encode(s).length };
};
const hexColour = /#[0-9a-f]{3,6}\b/i;

describe('graphics', () => {
	for (const name of ['net', 'tide', 'lamp', 'compass', 'crate'] as const)
		it(`vignette ${name}: ≤ 3 KB, aria-hidden, tokens only`, () => {
			const { s, bytes } = svg(render(Illustration, { props: { name, progress: 0.5 } }).body);
			expect(bytes).toBeGreaterThan(200);
			expect(bytes).toBeLessThanOrEqual(3072);
			expect(s).toContain('aria-hidden="true"');
			expect(s).not.toMatch(hexColour);
		});

	for (const [label, props] of [
		['coast', { category: 'beach' }],
		['heritage (bastion)', { category: 'fort' }],
		['heritage (shikhara)', { category: 'temple' }],
		['land', { kind: 'eatery' }]
	] as const)
		it(`no-photo scene ${label}: ≤ 1.2 KB, aria-hidden, tokens only`, () => {
			const { s, bytes } = svg(render(NoPhoto, { props }).body);
			expect(bytes).toBeLessThanOrEqual(1229);
			expect(s).toContain('aria-hidden="true"');
			expect(s).not.toMatch(hexColour);
		});

	it('QR plaque ≤ 1.5 KB and decorative', () => {
		const { s, bytes } = svg(renderQrMissing('en'));
		expect(bytes).toBeLessThanOrEqual(1536);
		expect(s).toContain('aria-hidden="true"');
	});

	it('crate fill follows progress', () => {
		const h = (progress: number) =>
			svg(render(Illustration, { props: { name: 'crate', progress } }).body).s.match(
				/<clipPath[^>]*><rect[^>]*height="([\d.]+)"/
			)?.[1];
		expect(h(0)).toBe('0');
		expect(h(0.5)).toBe('25');
		expect(h(1)).toBe('50');
	});

	it('pattern masks: weave ≤ 0.3 KB, laterite course ≤ 0.5 KB', () => {
		const css = readFileSync('src/app.css', 'utf8');
		const uri = (u: string) =>
			css.match(new RegExp(`@utility ${u} \\{[\\s\\S]*?url\\("(data:[^"]+)"\\)`))![1]!;
		expect(decodeURIComponent(uri('weave')).length).toBeLessThanOrEqual(307);
		expect(decodeURIComponent(uri('laterite-course')).length).toBeLessThanOrEqual(512);
	});
});
