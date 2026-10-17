import { error, json } from '@sveltejs/kit';
import { requireStaff } from '#lib/server/auth.ts';
import { createEatery, eateryInput } from '#lib/server/admin.ts';
import type { RequestHandler } from './$types';

// POST /api/admin/eateries — verifier field form (BACKEND §14). Lands as status 'in_review'.
export const POST: RequestHandler = async (event) => {
	const { locals, request } = event;
	await requireStaff(event);
	const b = eateryInput.safeParse(await request.json().catch(() => null));
	if (!b.success) error(400, b.error.issues.map((i) => i.path.join('.')).join(', '));
	try {
		return json(await createEatery(locals.supabase, b.data), { status: 201 });
	} catch (e) {
		const code = (e as { code?: string }).code;
		error(code === '42501' ? 403 : 400, (e as Error).message);
	}
};
