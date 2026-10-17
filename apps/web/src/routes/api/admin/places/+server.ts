import { error, json } from '@sveltejs/kit';
import { requireStaff } from '#lib/server/auth.ts';
import { createPlace, placeInput } from '#lib/server/admin.ts';
import type { RequestHandler } from './$types';

// POST /api/admin/places — verifier field form (BACKEND §14). Lands as status 'in_review'.
export const POST: RequestHandler = async (event) => {
	const { locals, request } = event;
	const s = await requireStaff(event);
	const b = placeInput.safeParse(await request.json().catch(() => null));
	if (!b.success) error(400, b.error.issues.map((i) => i.path.join('.')).join(', '));
	try {
		return json(await createPlace(locals.supabase, s.user.id, b.data), { status: 201 });
	} catch (e) {
		const code = (e as { code?: string }).code;
		error(code === '42501' ? 403 : 400, (e as Error).message);
	}
};
