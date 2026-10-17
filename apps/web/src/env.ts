import { defineEnvVars } from '@sveltejs/kit/env';

// Values come from the repo-root .env (kit `env.dir` in vite.config.ts). Optional so CI can build without them.
const optional = (value: string | undefined) => value;

export const variables = defineEnvVars({
	SUPABASE_URL: { public: true, schema: optional },
	SUPABASE_ANON_KEY: { public: true, schema: optional }
});
