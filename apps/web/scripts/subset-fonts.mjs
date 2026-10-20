// Build the self-hosted WOFF2 files (FRONTEND §2.3). DECISIONS P10-4 (overrides B12): each weight is split by
// unicode-range into a Latin file and a Devanagari file, so English pages never download Devanagari glyphs.
// Usage: node scripts/subset-fonts.mjs <dir with Baloo2.ttf (variable), Mukta-Regular.ttf, Mukta-SemiBold.ttf>
//        node scripts/subset-fonts.mjs --from-combined   (re-split the old combined static/fonts/<name>.woff2)
// Sources: github.com/google/fonts ofl/baloo2, ofl/mukta (SIL OFL 1.1).
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const arg = process.argv[2];
if (!arg) throw new Error('pass the source font directory, or --from-combined');

// Keep in sync with the unicode-range lines in src/app.css and src/lib/map/style.ts.
export const LATIN = [
	[0x0020, 0x007e],
	[0x00a0, 0x00ff],
	[0x0131, 0x0131],
	[0x0152, 0x0153],
	[0x02c6, 0x02c6],
	[0x02dc, 0x02dc],
	[0x2010, 0x2027],
	[0x2030, 0x203a],
	[0x20b9, 0x20b9], // ₹
	[0x2122, 0x2122],
	[0x2212, 0x2212]
];
export const DEVA = [
	[0x0900, 0x097f], // Devanagari
	[0x1cd0, 0x1cf9], // Vedic extensions
	[0x200b, 0x200d], // ZWSP, ZWNJ, ZWJ (conjunct control)
	[0x25cc, 0x25cc], // dotted circle
	[0xa8e0, 0xa8ff] // Devanagari extended
];
const chars = (ranges) =>
	ranges
		.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => String.fromCodePoint(a + i)))
		.join('');

const jobs = [
	{ file: 'Baloo2.ttf', name: 'baloo2-600', axes: { wght: 600 } },
	{ file: 'Baloo2.ttf', name: 'baloo2-700', axes: { wght: 700 } },
	{ file: 'Mukta-Regular.ttf', name: 'mukta-400' },
	{ file: 'Mukta-SemiBold.ttf', name: 'mukta-600' }
];

const outDir = fileURLToPath(new URL('../static/fonts/', import.meta.url));
await mkdir(outDir, { recursive: true });
for (const job of jobs) {
	const combined = join(outDir, `${job.name}.woff2`);
	const fromCombined = arg === '--from-combined';
	const font = await readFile(fromCombined ? combined : join(arg, job.file));
	for (const [part, ranges] of [
		['latin', LATIN],
		['deva', DEVA]
	]) {
		const woff2 = await subsetFont(font, chars(ranges), {
			targetFormat: 'woff2',
			...(!fromCombined && job.axes && { variationAxes: job.axes })
		});
		await writeFile(join(outDir, `${job.name}-${part}.woff2`), woff2);
		console.log(`${job.name}-${part}.woff2`, (woff2.length / 1024).toFixed(1), 'KB');
	}
	if (existsSync(combined)) await rm(combined);
}
