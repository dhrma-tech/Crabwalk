// One-off: placeholder PWA icons until the logo exists (FRONTEND §9, logo [OPEN]).
// Sand tile with a laterite disc; no deps (hand-rolled PNG encoder).
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});
const crc = (buf) => {
	let c = 0xffffffff;
	for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const td = Buffer.concat([Buffer.from(type), data]);
	const c = Buffer.alloc(4);
	c.writeUInt32BE(crc(td));
	return Buffer.concat([len, td, c]);
};

function png(size, discRatio) {
	const sand = [0xf6, 0xef, 0xe4];
	const laterite = [0xb5, 0x46, 0x2b];
	const raw = Buffer.alloc(size * (size * 3 + 1));
	const r = (size * discRatio) / 2;
	for (let y = 0; y < size; y++) {
		raw[y * (size * 3 + 1)] = 0;
		for (let x = 0; x < size; x++) {
			const d = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5);
			const px = d <= r ? laterite : sand;
			raw.set(px, y * (size * 3 + 1) + 1 + x * 3);
		}
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 2; // RGB
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw)),
		chunk('IEND', Buffer.alloc(0))
	]);
}

const out = new URL('../static/icons/', import.meta.url);
writeFileSync(new URL('icon-192.png', out), png(192, 0.7));
writeFileSync(new URL('icon-512.png', out), png(512, 0.7));
writeFileSync(new URL('icon-maskable-512.png', out), png(512, 0.5)); // inside the 80% safe zone
