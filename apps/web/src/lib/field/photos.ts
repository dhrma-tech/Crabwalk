// Client-side photo processing (DECISIONS P4-2): WebP at 480/960/1600 px (never upscaled) + ~20 px LQIP.
export const WIDTHS = [480, 960, 1600] as const;
export type Processed = {
	id: string;
	width: number;
	height: number;
	lqip: string;
	blobs: Partial<Record<(typeof WIDTHS)[number], Blob>>;
};

function draw(bmp: ImageBitmap, w: number) {
	const h = Math.round((bmp.height / bmp.width) * w);
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	c.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
	return c;
}
const toBlob = (c: HTMLCanvasElement, q: number) =>
	new Promise<Blob>((res, rej) =>
		c.toBlob(
			(b) => (b && b.type === 'image/webp' ? res(b) : rej(new Error('webp unsupported'))),
			'image/webp',
			q
		)
	);

export async function processPhoto(file: File): Promise<Processed> {
	const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
	const blobs: Processed['blobs'] = {};
	for (const w of WIDTHS)
		if (w <= bmp.width || w === WIDTHS[0])
			blobs[w] = await toBlob(draw(bmp, Math.min(w, bmp.width)), 0.8);
	const lqip = draw(bmp, 20).toDataURL('image/webp', 0.5);
	const out = { id: crypto.randomUUID(), width: bmp.width, height: bmp.height, lqip, blobs };
	bmp.close();
	return out;
}

export async function uploadPhoto(
	p: Processed,
	entity: { type: string; id: string },
	hero: boolean
) {
	const f = new FormData();
	Object.entries({
		id: p.id,
		entity_type: entity.type,
		entity_id: entity.id,
		is_hero: hero ? '1' : '0',
		width: String(p.width),
		height: String(p.height),
		lqip: p.lqip
	}).forEach(([k, v]) => f.set(k, v));
	for (const [w, b] of Object.entries(p.blobs))
		f.set(`w${w}`, new File([b!], `${p.id}-${w}.webp`, { type: 'image/webp' }));
	const res = await fetch('/api/admin/photos', { method: 'POST', body: f });
	if (!res.ok) throw Object.assign(new Error(`photo ${res.status}`), { status: res.status });
}
