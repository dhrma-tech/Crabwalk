// G7 / DECISIONS P8-5: multilingual-e5-small (384-d) embeddings for published places → place_embeddings.
// Batch only (place-to-place similarity), so no runtime embedding service. Text = names (EN/MR/HI),
// category and the published short story — never contacts. Re-run after content changes.
import { pipeline } from '@huggingface/transformers';
import { db, logger, target } from '../lib/common.ts';

const log = logger('embeddings');
const MODEL = 'Xenova/multilingual-e5-small';

const client = await db();
const { rows } = await client.query<{ id: string; category: string; text: string }>(`
  select p.id, p.category::text,
         concat_ws(' · ', string_agg(t.name, ' · '), p.category::text, max(t.short_story) filter (where t.lang = 'en')) as text
  from places p join place_translations t on t.place_id = p.id
  where p.status = 'published'
  group by p.id`);
log(`${rows.length} published places (${target()})`);

const embed = await pipeline('feature-extraction', MODEL, { dtype: 'q8' });
let n = 0;
for (const r of rows) {
	// e5 expects the "passage: " prefix for documents.
	const out = await embed(`passage: ${r.text}`, { pooling: 'mean', normalize: true });
	const vec = `[${Array.from(out.data as Float32Array).join(',')}]`;
	await client.query(
		`insert into place_embeddings (place_id, embedding) values ($1, $2::extensions.vector)
		 on conflict (place_id) do update set embedding = excluded.embedding, updated_at = now()`,
		[r.id, vec]
	);
	n++;
}
await client.query(`delete from place_embeddings e where not exists (select 1 from places p where p.id = e.place_id and p.status = 'published')`);
log(`embedded ${n} places`);
await client.end();
