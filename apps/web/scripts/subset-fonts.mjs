// Build the self-hosted WOFF2 files (Suna, DECISIONS P10a-3). 4 weights, each split by unicode-range into a
// Latin file and a Devanagari file (P10-4), so English pages never download Devanagari glyphs.
// Usage: node scripts/subset-fonts.mjs <dir with the source TTFs below>
// Sources (SIL OFL 1.1, github.com/google/fonts): ofl/shipporimincho, ofl/notoserifdevanagari,
// ofl/zenkakugothicnew, ofl/notosansdevanagari.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const dir = process.argv[2];
if (!dir) throw new Error('pass the source font directory');

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
// The 蟹 (crab) logo mark is set in the serif (U+87F9 in the serif Latin file only).
const LOGO = '蟹';

const SERIF_DEVA = 'NotoSerifDevanagari[wdth,wght].ttf';
const SANS_DEVA = 'NotoSansDevanagari[wdth,wght].ttf';
const jobs = [
	{ name: 'serif-400', latin: 'ShipporiMincho-Regular.ttf', deva: SERIF_DEVA, wght: 400 },
	{ name: 'sans-400', latin: 'ZenKakuGothicNew-Regular.ttf', deva: SANS_DEVA, wght: 400 },
	{ name: 'sans-500', latin: 'ZenKakuGothicNew-Medium.ttf', deva: SANS_DEVA, wght: 500 },
	{ name: 'sans-700', latin: 'ZenKakuGothicNew-Bold.ttf', deva: SANS_DEVA, wght: 700 }
];

const outDir = fileURLToPath(new URL('../static/fonts/', import.meta.url));
await mkdir(outDir, { recursive: true });
for (const job of jobs) {
	for (const [part, file, text, axes] of [
		['latin', job.latin, chars(LATIN) + (job.name.startsWith('serif') ? LOGO : ''), undefined],
		['deva', job.deva, chars(DEVA), { wght: job.wght, wdth: 100 }]
	]) {
		const woff2 = await subsetFont(await readFile(join(dir, file)), text, {
			targetFormat: 'woff2',
			...(axes && { variationAxes: axes })
		});
		await writeFile(join(outDir, `${job.name}-${part}.woff2`), woff2);
		console.log(`${job.name}-${part}.woff2`, (woff2.length / 1024).toFixed(1), 'KB');
	}
}
