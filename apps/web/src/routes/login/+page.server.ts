import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { SUPABASE_URL } from '$app/env/public';
import { NEXT_COOKIE, nextPath } from '#lib/login.ts';
import type { Actions, PageServerLoad } from './$types';

const email = z.email().max(254);
const code = z.string().regex(/^\d{6}$/);

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = await locals.getUser();
	const next = nextPath(url.searchParams.get('next'));
	if (user && next) redirect(303, next);
	return { email: user?.email ?? null, error: url.searchParams.get('error'), next };
};

export const actions: Actions = {
	google: async ({ locals, url, request, cookies }) => {
		const next = nextPath((await request.formData()).get('next'));
		if (next)
			cookies.set(NEXT_COOKIE, next, {
				path: '/auth/callback',
				httpOnly: true,
				sameSite: 'lax',
				maxAge: 600
			});
		const { data, error } = await locals.supabase.auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: `${url.origin}/auth/callback` }
		});
		if (error || !data.url) return fail(502, { error: 'oauth', next });
		// Only our Supabase project is an allowed external redirect target.
		redirect(303, data.url, { external: [new URL(SUPABASE_URL!).origin] });
	},

	sendCode: async ({ locals, request }) => {
		const form = await request.formData();
		const next = nextPath(form.get('next'));
		const e = email.safeParse(String(form.get('email') ?? '').trim());
		if (!e.success) return fail(400, { error: 'email', next });
		const { error } = await locals.supabase.auth.signInWithOtp({ email: e.data });
		if (error)
			return error.status === 429
				? fail(429, { error: 'rate', email: e.data, next })
				: fail(502, { error: 'send', email: e.data, next });
		return { sent: true, email: e.data, next };
	},

	verifyCode: async ({ locals, request }) => {
		const form = await request.formData();
		const next = nextPath(form.get('next'));
		const e = email.safeParse(String(form.get('email') ?? '').trim());
		const c = code.safeParse(String(form.get('token') ?? '').trim());
		if (!e.success) return fail(400, { error: 'email', next });
		if (!c.success) return fail(400, { error: 'code', sent: true, email: e.data, next });
		const { error } = await locals.supabase.auth.verifyOtp({
			email: e.data,
			token: c.data,
			type: 'email'
		});
		if (error) return fail(400, { error: 'code', sent: true, email: e.data, next });
		redirect(303, next ?? '/login');
	},

	signOut: async ({ locals }) => {
		await locals.supabase.auth.signOut();
		redirect(303, '/login');
	}
};
