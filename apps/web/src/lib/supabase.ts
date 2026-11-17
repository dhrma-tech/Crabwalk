// Browser Supabase client, only for Realtime on the plan workspace (P11 §6). The auth cookies are httpOnly
// (SEC-10), so it holds no session of its own: the page hands Realtime the user's token from GET /api/me/token,
// and Realtime applies the same RLS as the server. Data reads and writes stay on the server.
import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '$app/env/public';
import type { Database } from '#lib/db.types.ts';

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;
export const browserClient = () =>
	(client ??= createBrowserClient<Database>(SUPABASE_URL!, SUPABASE_ANON_KEY!));
