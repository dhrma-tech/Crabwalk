// Field-journal fonts for the landing and onboarding (docs/crabwalk-handoff/PLAN.md §2): Gloock 400 (display, Latin),
// Instrument Sans variable wght 400–600 (UI, Latin, wdth pinned to 100), Tiro Devanagari Marathi 400 (Devanagari).
// Three WOFF2 files; the Devanagari one downloads only when Devanagari is on screen (unicode-range).
// Usage: node scripts/subset-journal-fonts.mjs <dir with the source TTFs below>
// Sources (SIL OFL 1.1, github.com/google/fonts): ofl/gloock, ofl/instrumentsans, ofl/tirodevanagarimarathi.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const dir = process.argv[2];
if (!dir) throw new Error('pass the source font directory');

// Keep in sync with the unicode-range lines in src/lib/journal/journal.css.
const LATIN = [
	[0x0020, 0x007e],
	[0x00a0, 0x00ff],
	[0x2010, 0x2027],
	[0x2030, 0x203a],
	[0x20b9, 0x20b9], // ₹
	[0x2190, 0x2193], // ← ↑ → ↓
	[0x2212, 0x2212]
];
const DEVA = [
	[0x0900, 0x097f],
	[0x1cd0, 0x1cf9],
	[0x200b, 0x200d],
	[0x25cc, 0x25cc],
	[0xa8e0, 0xa8ff]
];
const chars = (ranges) =>
	ranges
		.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => String.fromCodePoint(a + i)))
		.join('');

const jobs = [
	{ out: 'journal-display-latin.woff2', src: 'Gloock-Regular.ttf', text: chars(LATIN) },
	{
		out: 'journal-text-latin.woff2',
		src: 'InstrumentSans.ttf',
		text: chars(LATIN),
		axes: { wdth: 100, wght: { min: 400, max: 600, default: 400 } }
	},
	{ out: 'journal-deva.woff2', src: 'TiroDevanagariMarathi-Regular.ttf', text: chars(DEVA) }
];

const outDir = fileURLToPath(new URL('../static/fonts/', import.meta.url));
await mkdir(outDir, { recursive: true });
for (const j of jobs) {
	const buf = await subsetFont(await readFile(join(dir, j.src)), j.text, {
		targetFormat: 'woff2',
		variationAxes: j.axes
	});
	await writeFile(join(outDir, j.out), buf);
	console.log(j.out, (buf.length / 1024).toFixed(1), 'KB');
}
