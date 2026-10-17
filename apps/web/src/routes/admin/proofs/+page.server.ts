import { fail } from '@sveltejs/kit';
import { getLocale } from '#lib/paraglide/runtime.js';
import { requireStaff } from '#lib/server/auth.ts';
import { tr, type Lang } from '#lib/server/listings.ts';
import type { Actions, PageServerLoad } from './$types';

// Booking-proof queue (G6). RLS limits verifiers to their talukas. Images are shown via short-lived signed
// URLs and deleted on decision (the cleanup job covers anything left after 30 days).
export const load: PageServerLoad = async (event) => {
	await requireStaff(event);
	const lang = getLocale() as Lang;
	const db = event.locals.supabase;
	const { data } = await db
		.from('booking_proofs')
		.select('id, entity_type, entity_id, storage_path, created_at')
		.eq('status', 'pending')
		.order('created_at')
		.limit(50);
	const proofs = data ?? [];
	const ids = (t: string) => proofs.filter((p) => p.entity_type === t).map((p) => p.entity_id);
	const paths = proofs.map((p) => p.storage_path).filter((p): p is string => !!p);
	const [s, e, signed] = await Promise.all([
		db.from('stays').select('id, stay_translations(lang, name)').in('id', ids('stay')),
		db.from('eateries').select('id, eatery_translations(lang, name)').in('id', ids('eatery')),
		paths.length
			? db.storage.from('booking-proofs').createSignedUrls(paths, 600)
			: Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] })
	]);
	const names = new Map<string, string | null>([
		...(s.data ?? []).map((x) => [x.id, tr(x.stay_translations, lang)] as const),
		...(e.data ?? []).map((x) => [x.id, tr(x.eatery_translations, lang)] as const)
	]);
	const urls = new Map((signed.data ?? []).map((u) => [u.path, u.signedUrl]));
	return {
		proofs: proofs.map((p) => ({
			id: p.id,
			type: p.entity_type,
			name: names.get(p.entity_id) ?? null,
			url: urls.get(p.storage_path ?? '') ?? null,
			created_at: p.created_at
		}))
	};
};

export const actions: Actions = {
	decide: async (event) => {
		await requireStaff(event);
		const f = await event.request.formData();
		const id = String(f.get('id'));
		const db = event.locals.supabase;
		const { data: p } = await db
			.from('booking_proofs')
			.select('storage_path')
			.eq('id', id)
			.eq('status', 'pending')
			.maybeSingle();
		if (!p) return fail(404);
		if (p.storage_path) {
			const { error: rm } = await db.storage.from('booking-proofs').remove([p.storage_path]);
			if (rm) return fail(403);
		}
		const { error } = await db.rpc('review_booking_proof', {
			_proof: id,
			_approve: f.get('approve') === '1'
		});
		if (error) return fail(403);
	}
};
