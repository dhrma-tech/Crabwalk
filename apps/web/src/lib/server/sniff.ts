// Image type from the file's first bytes (hardening 2026-11, SEC-18). Upload endpoints compare it with the type the
// browser declared, so a text or HTML file sent as image/webp is refused before it reaches Storage.
export type Sniffed = 'webp' | 'jpeg' | 'png';

const MIME: Record<string, Sniffed> = {
	'image/webp': 'webp',
	'image/jpeg': 'jpeg',
	'image/png': 'png'
};

export async function sniff(file: Blob): Promise<Sniffed | null> {
	const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
	const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
	if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
	if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
	if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x)) return 'png';
	return null;
}

/** True when the bytes are the image type the browser declared (`file.type`). */
export const typeMatches = async (file: Blob) =>
	!!MIME[file.type] && (await sniff(file)) === MIME[file.type];
