// Daily (pg_cron): G6 — booking-proof images never outlive 30 days. Expired proofs: delete the image via the
// Storage API (direct SQL deletes on storage.objects are blocked, P1-17) and auto-reject if still pending
// (DECISIONS P5-2). The user can upload again.
import { admin, authorized, json } from '../_shared/cron.ts';

Deno.serve(async (req) => {
	if (!authorized(req)) return json({ error: 'unauthorized' }, 401);
	const db = admin();
	const { data: expired, error } = await db
		.from('booking_proofs')
		.select('id, storage_path, status')
		.lt('delete_after', new Date().toISOString())
		.not('storage_path', 'is', null)
		.limit(500);
	if (error) return json({ error: error.message }, 500);
	if (!expired.length) return json({ deleted: 0 });

	const { error: rmErr } = await db.storage.from('booking-proofs').remove(expired.map((p) => p.storage_path!));
	if (rmErr) return json({ error: rmErr.message }, 500);
	for (const p of expired) {
		await db
			.from('booking_proofs')
			.update({ storage_path: null, ...(p.status === 'pending' && { status: 'rejected', reviewed_at: new Date().toISOString() }) })
			.eq('id', p.id);
	}
	return json({ deleted: expired.length });
});
