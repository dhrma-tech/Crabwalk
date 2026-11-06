// Service-role Supabase client (server only). Used only after gateAdmin() has verified the admin cookie:
// the admin editor (lib/server/content.ts) and admin session provisioning (lib/server/adminSession.ts).
// Never import this from client code or from AI code.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '$app/env/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$app/env/private';
import type { Database } from '#lib/db.types.ts';

let client: SupabaseClient<Database> | undefined;
export function serviceClient() {
	if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
		throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
	return (client ??= createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: { persistSession: false, autoRefreshToken: false }
	}));
}
