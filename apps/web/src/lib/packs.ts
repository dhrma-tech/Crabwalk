// Offline taluka packs on the device (FRONTEND §9): pack PMTiles + data JSON in Cache Storage. The service
// worker answers the map's Range requests from these cached files, so the map works with no network.
export const PACKS_CACHE = 'packs-v1';
const META = '/__packs/meta.json';

export type Pack = {
	id: string;
	name: string;
	tiles: string;
	bytes: number;
	version: string;
	data: string;
};
export type Saved = Record<string, Pack & { saved_at: string }>;
export type PackData = {
	places: {
		kind: 'place';
		slug: string;
		category: string;
		names: Record<string, string | null>;
		at: [number, number];
	}[];
	stays: {
		kind: 'stay';
		slug: string;
		names: Record<string, string | null>;
		at: [number, number];
	}[];
	eateries: {
		kind: 'eatery';
		slug: string;
		names: Record<string, string | null>;
		at: [number, number];
	}[];
	utilities: { type: string; name: string | null; phone: string | null; at: [number, number] }[];
};

const open = () => caches.open(PACKS_CACHE);

export async function savedPacks(): Promise<Saved> {
	try {
		const r = await (await open()).match(META);
		return r ? ((await r.json()) as Saved) : {};
	} catch {
		return {};
	}
}

async function writeMeta(c: Cache, meta: Saved) {
	await c.put(
		META,
		new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } })
	);
}

export async function downloadPack(p: Pack) {
	const c = await open();
	const [tiles, data] = await Promise.all([fetch(p.tiles, { mode: 'cors' }), fetch(p.data)]);
	if (!tiles.ok || !data.ok) throw new Error('download failed');
	await Promise.all([c.put(p.tiles, tiles), c.put(p.data, data)]);
	const meta = await savedPacks();
	meta[p.id] = { ...p, saved_at: new Date().toISOString() };
	await writeMeta(c, meta);
}

export async function deletePack(id: string) {
	const c = await open();
	const meta = await savedPacks();
	const p = meta[id];
	if (!p) return;
	await Promise.all([c.delete(p.tiles), c.delete(p.data)]);
	delete meta[id];
	await writeMeta(c, meta);
}

/** All downloaded pack data merged (for offline pins, emergency hospitals). */
export async function offlineData(): Promise<PackData> {
	const out: PackData = { places: [], stays: [], eateries: [], utilities: [] };
	const c = await open().catch(() => null);
	if (!c) return out;
	for (const p of Object.values(await savedPacks())) {
		const r = await c.match(p.data);
		if (!r) continue;
		const d = (await r.json()) as PackData;
		out.places.push(...d.places);
		out.stays.push(...d.stays);
		out.eateries.push(...d.eateries);
		out.utilities.push(...d.utilities);
	}
	return out;
}
