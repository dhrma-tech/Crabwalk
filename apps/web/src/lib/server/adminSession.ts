// TODO(before-deploy): restore full auth — temporary access gate (docs/RESTORE_AUTH.md).
// After the allowlist check, the browser gets a real Supabase session for that email (created on first use,
// app_metadata.temp_admin = true, admin role row), so the existing admin pages and their RPCs (approve_listing,
// create_qr_code, …) keep running under RLS as an admin. hooks.server.ts signs a temp_admin session out as soon
// as its signed cookie is missing, expired or off the allowlist.
import type { RequestEvent } from '@sveltejs/kit';
import { serviceClient } from './service.ts';

export async function startAdminSession(event: Pick<RequestEvent, 'locals'>, email: string) {
	const admin = serviceClient();
	const made = await admin.auth.admin.createUser({
		email,
		email_confirm: true,
		app_metadata: { temp_admin: true }
	});
	if (made.error && made.error.code !== 'email_exists') throw made.error;
	const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
	if (link.error) throw link.error;
	const user = link.data.user;
	if (!user.app_metadata?.temp_admin) {
		const { error } = await admin.auth.admin.updateUserById(user.id, {
			app_metadata: { ...user.app_metadata, temp_admin: true }
		});
		if (error) throw error;
	}
	const { data: has } = await admin
		.from('user_roles')
		.select('id')
		.eq('user_id', user.id)
		.eq('role', 'admin')
		.is('taluka_id', null)
		.is('entity_id', null)
		.maybeSingle();
	if (!has) {
		const { error } = await admin.from('user_roles').insert({ user_id: user.id, role: 'admin' });
		if (error) throw error;
	}
	// Exchanging the one-time token on the request's own client writes the session cookies (no email sent).
	const { error } = await event.locals.supabase.auth.verifyOtp({
		token_hash: link.data.properties.hashed_token,
		type: 'email'
	});
	if (error) throw error;
}
