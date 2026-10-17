import { fail, redirect } from '@sveltejs/kit';
import { SUPABASE_URL } from '$app/env/public';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = await locals.getUser();
	return { email: user?.email ?? null, error: url.searchParams.get('error') };
};

export const actions: Actions = {
	google: async ({ locals, url }) => {
		const { data, error } = await locals.supabase.auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: `${url.origin}/auth/callback` }
		});
		if (error || !data.url) return fail(502, { error: 'oauth' });
		// Only our Supabase project is an allowed external redirect target.
		redirect(303, data.url, { external: [new URL(SUPABASE_URL!).origin] });
	},

	sendCode: async ({ locals, request }) => {
		const email = String((await request.formData()).get('email') ?? '').trim();
		if (!email) return fail(400, { error: 'email' });
		const { error } = await locals.supabase.auth.signInWithOtp({ email });
		if (error)
			return error.status === 429
				? fail(429, { error: 'rate', email })
				: fail(502, { error: 'send', email });
		return { sent: true, email };
	},

	verifyCode: async ({ locals, request }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const token = String(form.get('token') ?? '').trim();
		const { error } = await locals.supabase.auth.verifyOtp({ email, token, type: 'email' });
		if (error) return fail(400, { error: 'code', sent: true, email });
		redirect(303, '/login');
	},

	signOut: async ({ locals }) => {
		await locals.supabase.auth.signOut();
		redirect(303, '/login');
	}
};
