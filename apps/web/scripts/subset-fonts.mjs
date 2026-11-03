// Build the self-hosted WOFF2 files (DECISIONS T-58): EB Garamond 400 for display and Figtree (variable wght
// 400–700) for text. Neither has Devanagari, so the text font's Devanagari half is Anek Devanagari (wght 400–700,
// wdth pinned to 100), also used for display Devanagari (T-23). Split by unicode-range into Latin and Devanagari
// files (P10-4), so English pages never download Devanagari glyphs: 3 files in all.
// Usage: node scripts/subset-fonts.mjs <dir with the source TTFs below>
// Sources (SIL OFL 1.1, github.com/google/fonts): ofl/ebgaramond, ofl/figtree, ofl/anekdevanagari.
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
	[0x2030, 0x203a], // incl. ‹ › of the wordmark
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

// The text files keep their weight axis (one file serves 400–700); default 400 is what the map draws with
// (MapLibre font-faces use a file's default instance).
const WGHT = { min: 400, max: 700, default: 400 };
const jobs = [
	// EB Garamond's small caps, old-style figures and swashes triple the file (56.5 → 18.8 KB without them):
	// drop glyphs only reachable through layout features; kerning stays.
	{
		name: 'display-400',
		latin: 'EBGaramond[wght].ttf',
		axes: { wght: 400 },
		noLayoutClosure: true
	},
	{
		name: 'text-var',
		latin: 'Figtree[wght].ttf',
		deva: 'AnekDevanagari[wdth,wght].ttf',
		axes: { wght: WGHT },
		devaAxes: { wdth: 100, wght: WGHT }
	}
];

const outDir = fileURLToPath(new URL('../static/fonts/', import.meta.url));
await mkdir(outDir, { recursive: true });
for (const job of jobs) {
	for (const [part, file, text, axes] of [
		['latin', job.latin, chars(LATIN), job.axes],
		['deva', job.deva, chars(DEVA), job.devaAxes]
	]) {
		if (!file) continue;
		const woff2 = await subsetFont(await readFile(join(dir, file)), text, {
			targetFormat: 'woff2',
			variationAxes: axes,
			noLayoutClosure: job.noLayoutClosure
		});
		await writeFile(join(outDir, `${job.name}-${part}.woff2`), woff2);
		console.log(`${job.name}-${part}.woff2`, (woff2.length / 1024).toFixed(1), 'KB');
	}
}
