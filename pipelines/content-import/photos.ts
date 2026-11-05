// Openly licensed Commons photos for desk places (DECISIONS T-7 / T-51): CC BY / CC BY-SA only, credit + licence +
// source page on the record. Same files as the field form (DECISIONS P4-2): <type>/<id>/<uuid>-{480,960,1600}.webp,
// never upscaled, plus a ~20 px WebP blur placeholder. Uploads go to the local stack's `photos` bucket with its
// service key (read from `supabase status`, never from .env, so nothing reaches the hosted project). A failed
// download or upload is logged and the next photo goes on. Idempotent: a place that already has a photo with the
// same source page is skipped.
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import type pg from 'pg';
import sharp from 'sharp';
import { ROOT } from '../lib/common.ts';

export type Photo = {
	slug: string;
	entity_id: string;
	file_url: string;
	credit: string;
	licence: string;
	source_url: string;
	is_hero: boolean;
};
const WIDTHS = [480, 960, 1600] as const;
const MAX = 3 * 1024 * 1024; // bucket limit
// Wikimedia asks for an identifying User-Agent.
const UA = 'Crabwalk-desk-import/1.0 (https://github.com/dhrma-tech/Crabwalk)';

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** One request at a time, about one a second; a 429 waits (Retry-After, else 5 s doubling) and retries up to 4 times. */
async function get(url: string, method = 'GET') {
	for (let i = 0; ; i++) {
		await pause(1000);
		const r = await fetch(url, { method, headers: { 'User-Agent': UA } });
		if (r.status !== 429 || i === 4) return r;
		await pause((Number(r.headers.get('retry-after')) || 5 * 2 ** i) * 1000);
	}
}

/** Dry run: size of each file at the source (HEAD only, nothing downloaded). */
export async function photoSizes(rows: Photo[]) {
	let bytes = 0;
	const failed: string[] = [];
	for (const p of rows) {
		const r = await get(p.file_url, 'HEAD').catch((e: Error) => e);
		if (r instanceof Error || !r.ok) failed.push(`${p.slug}: ${r instanceof Error ? r.message : r.status} ${p.file_url}`);
		else bytes += Number(r.headers.get('content-length') ?? 0);
	}
	return { bytes, failed };
}

export async function importPhotos(c: pg.Client, rows: Photo[], ownerEmail: string) {
	const owner = (
		await c.query(
			`select u.id from auth.users u join public.user_roles r on r.user_id = u.id and r.role = 'admin' where u.email = $1`,
			[ownerEmail]
		)
	).rows[0]?.id as string | undefined;
	if (!owner) throw new Error(`${ownerEmail} is not an admin on this database`);
	const s = JSON.parse(
		execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], { cwd: join(ROOT, '..'), encoding: 'utf8', shell: true })
	) as { API_URL: string; SERVICE_ROLE_KEY: string };
	const out = { insert: 0, skip: 0, reject: 0, failed: [] as string[] };
	for (const p of rows) {
		try {
			const dup = await c.query(
				`select 1 from public.photos where entity_type = 'place' and entity_id = $1 and source_url = $2`,
				[p.entity_id, p.source_url]
			);
			if (dup.rowCount) {
				out.skip++;
				continue;
			}
			const res = await get(p.file_url);
			if (!res.ok) throw new Error(`download ${res.status}`);
			const base = await sharp(Buffer.from(await res.arrayBuffer())).rotate().toBuffer();
			const { width, height } = await sharp(base).metadata();
			if (!width || !height) throw new Error('unreadable image');
			const id = randomUUID();
			const path = `place/${p.entity_id}/${id}`;
			for (const w of WIDTHS) {
				if (w > width && w !== WIDTHS[0]) continue;
				const file = await sharp(base).resize({ width: Math.min(w, width) }).webp({ quality: 80 }).toBuffer();
				if (file.length > MAX) throw new Error(`${w} px WebP is over 3 MB`);
				const up = await fetch(`${s.API_URL}/storage/v1/object/photos/${path}-${w}.webp`, {
					method: 'POST',
					headers: { Authorization: `Bearer ${s.SERVICE_ROLE_KEY}`, 'Content-Type': 'image/webp', 'x-upsert': 'true' },
					body: file
				});
				if (!up.ok) throw new Error(`upload ${w}: ${up.status} ${await up.text()}`);
			}
			const lqip = `data:image/webp;base64,${(await sharp(base).resize({ width: 20 }).webp({ quality: 50 }).toBuffer()).toString('base64')}`;
			await c.query(
				`insert into public.photos (entity_type, entity_id, storage_path, lqip, width, height, uploaded_by, is_hero,
				   credit, licence, source_url)
				 values ('place', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
				[p.entity_id, path, lqip, width, height, owner, p.is_hero, p.credit, p.licence, p.source_url]
			);
			out.insert++;
		} catch (e) {
			out.reject++;
			out.failed.push(`${p.slug}: ${(e as Error).message} (${p.file_url})`);
		}
	}
	return out;
}
