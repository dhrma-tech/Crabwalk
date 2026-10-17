// One-off: build the 4 self-hosted WOFF2 files (FRONTEND §2.3, DECISIONS B12).
// Usage: node scripts/subset-fonts.mjs <dir with Baloo2[wght].ttf as Baloo2.ttf, Mukta-Regular.ttf, Mukta-SemiBold.ttf>
// Sources: github.com/google/fonts ofl/baloo2, ofl/mukta (SIL OFL 1.1).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import subsetFont from 'subset-font';

const src = process.argv[2];
if (!src) throw new Error('pass the source font directory');

const ranges = [
	[0x0020, 0x007e],
	[0x00a0, 0x00ff],
	[0x0131, 0x0131],
	[0x0152, 0x0153],
	[0x02c6, 0x02c6],
	[0x02dc, 0x02dc],
	[0x0900, 0x097f], // Devanagari
	[0x1cd0, 0x1cf9], // Vedic extensions
	[0x200b, 0x200d], // ZWSP, ZWNJ, ZWJ (conjunct control)
	[0x2010, 0x2027],
	[0x2030, 0x203a],
	[0x20b9, 0x20b9], // ₹
	[0x2122, 0x2122],
	[0x2212, 0x2212],
	[0x25cc, 0x25cc], // dotted circle
	[0xa8e0, 0xa8ff] // Devanagari extended
];
const text = ranges
	.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => String.fromCodePoint(a + i)))
	.join('');

const jobs = [
	{ file: 'Baloo2.ttf', out: 'baloo2-600.woff2', axes: { wght: 600 } },
	{ file: 'Baloo2.ttf', out: 'baloo2-700.woff2', axes: { wght: 700 } },
	{ file: 'Mukta-Regular.ttf', out: 'mukta-400.woff2' },
	{ file: 'Mukta-SemiBold.ttf', out: 'mukta-600.woff2' }
];

const outDir = new URL('../static/fonts/', import.meta.url);
await mkdir(outDir, { recursive: true });
for (const job of jobs) {
	const font = await readFile(join(src, job.file));
	const woff2 = await subsetFont(font, text, {
		targetFormat: 'woff2',
		...(job.axes && { variationAxes: job.axes })
	});
	await writeFile(new URL(job.out, outDir), woff2);
	console.log(job.out, (woff2.length / 1024).toFixed(1), 'KB');
}
