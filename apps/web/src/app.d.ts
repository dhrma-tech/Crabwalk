// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';

declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		interface Error {
			/** Short reference for unexpected errors, logged server-side with the details. */
			id?: string;
		}
		interface Locals {
			supabase: SupabaseClient<Database>;
			getUser: () => Promise<User | null>;
		}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
