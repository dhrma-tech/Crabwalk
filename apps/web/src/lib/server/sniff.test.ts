import { describe, expect, it } from 'vitest';
import { sniff, typeMatches } from './sniff.ts';

const bytes = (...b: (number | string)[]) =>
	new Uint8Array(
		b.flatMap((x) => (typeof x === 'string' ? [...x].map((c) => c.charCodeAt(0)) : [x]))
	);
const WEBP = bytes('RIFF', 0x24, 0, 0, 0, 'WEBP', 'VP8 ');
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 'JFIF');
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d);

describe('upload sniffing (SEC-18)', () => {
	it('recognises WebP, JPEG and PNG by their first bytes', async () => {
		expect(await sniff(new Blob([WEBP]))).toBe('webp');
		expect(await sniff(new Blob([JPEG]))).toBe('jpeg');
		expect(await sniff(new Blob([PNG]))).toBe('png');
	});
	it('a text file is nothing, whatever its declared type', async () => {
		const text = new File(['<script>alert(1)</script>'], 'x.webp', { type: 'image/webp' });
		expect(await sniff(text)).toBeNull();
		expect(await typeMatches(text)).toBe(false);
		expect(await sniff(new Blob([]))).toBeNull();
		expect(await sniff(new Blob([bytes('RIFF', 0, 0, 0, 0, 'WAVE')]))).toBeNull();
	});
	it('the declared type must match the bytes', async () => {
		expect(await typeMatches(new File([WEBP], 'a.webp', { type: 'image/webp' }))).toBe(true);
		expect(await typeMatches(new File([JPEG], 'a.webp', { type: 'image/webp' }))).toBe(false);
		expect(await typeMatches(new File([PNG], 'a.png', { type: 'image/png' }))).toBe(true);
		expect(await typeMatches(new File([PNG], 'a.svg', { type: 'image/svg+xml' }))).toBe(false);
	});
});
