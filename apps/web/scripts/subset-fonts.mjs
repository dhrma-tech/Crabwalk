// Build the self-hosted WOFF2 files (Tideline, DECISIONS T-1, Report 2 §4.1): Eczar 700 for display and Anek
// (variable wght 400–700, wdth pinned to 100) for text. Each is split by unicode-range into a Latin file and a
// Devanagari file (P10-4), so English pages never download Devanagari glyphs. Display Devanagari reuses the
// Anek file at 700 (T-23: Eczar's Marathi forms break the reph), so 3 files in all.
// Usage: node scripts/subset-fonts.mjs <dir with the source TTFs below>
// Sources (SIL OFL 1.1, github.com/google/fonts): ofl/eczar, ofl/aneklatin, ofl/anekdevanagari.
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

// Anek keeps its weight axis (one file serves 400–700); default 400 is what the map draws with (MapLibre
// font-faces use a file's default instance).
const TEXT = { wdth: 100, wght: { min: 400, max: 700, default: 400 } };
const jobs = [
	{ name: 'display-700', latin: 'Eczar[wght].ttf', axes: { wght: 700 } },
	{
		name: 'text-var',
		latin: 'AnekLatin[wdth,wght].ttf',
		deva: 'AnekDevanagari[wdth,wght].ttf',
		axes: TEXT
	}
];

const outDir = fileURLToPath(new URL('../static/fonts/', import.meta.url));
await mkdir(outDir, { recursive: true });
for (const job of jobs) {
	for (const [part, file, text] of [
		['latin', job.latin, chars(LATIN)],
		['deva', job.deva, chars(DEVA)]
	]) {
		if (!file) continue;
		const woff2 = await subsetFont(await readFile(join(dir, file)), text, {
			targetFormat: 'woff2',
			variationAxes: job.axes
		});
		await writeFile(join(outDir, `${job.name}-${part}.woff2`), woff2);
		console.log(`${job.name}-${part}.woff2`, (woff2.length / 1024).toFixed(1), 'KB');
	}
}
