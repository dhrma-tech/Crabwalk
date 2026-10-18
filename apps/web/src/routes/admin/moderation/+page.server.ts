import { fail } from '@sveltejs/kit';
import { SUPABASE_URL } from '$app/env/public';
import { requireStaff } from '#lib/server/auth.ts';
import { prescreen } from '#lib/server/ai/moderation.ts';
import type { Actions, PageServerLoad } from './$types';

// Moderation queue (PLAN P5 task 5). A small model pre-screens (P8); reviewers decide.
export const load: PageServerLoad = async (event) => {
	await requireStaff(event, 'reviewer');
	const { data } = await event.locals.supabase
		.from('reviews')
		.select(
			'id, entity_type, entity_id, group_type, text, created_at, ai_flag, ai_reason, review_photos(id, storage_path)'
		)
		.eq('moderation_status', 'pending')
		.order('created_at')
		.limit(50);
	await prescreen(event.locals.supabase, data ?? []);
	return {
		reviews: (data ?? []).map((r) => ({
			...r,
			photos: r.review_photos.map(
				(p) => `${SUPABASE_URL}/storage/v1/object/public/review-photos/${p.storage_path}-480.webp`
			)
		}))
	};
};

export const actions: Actions = {
	decide: async (event) => {
		await requireStaff(event, 'reviewer');
		const f = await event.request.formData();
		const status = f.get('approve') === '1' ? 'approved' : 'rejected';
		const { error } = await event.locals.supabase
			.from('reviews')
			.update({ moderation_status: status })
			.eq('id', String(f.get('id')));
		if (error) return fail(403);
	}
};
