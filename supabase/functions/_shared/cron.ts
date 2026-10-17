// Shared bits for cron-invoked functions: secret check + service-role client.
import { createClient } from 'jsr:@supabase/supabase-js@2';

export function authorized(req: Request) {
	const secret = Deno.env.get('CRON_SECRET');
	return !!secret && req.headers.get('Authorization') === `Bearer ${secret}`;
}

export const admin = () =>
	createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
		auth: { persistSession: false }
	});

export const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
