import { dev } from '$app/env';
import { DEV_BYPASS_AUTH } from '$app/env/public';

// Dev-only auth bypass for frontend work (DEV_BYPASS_AUTH=true in .env.local). Never on in a production
// build or off localhost. Shared gate only: the hook lives in devAuth.server.ts, the toast in devAuth.client.ts.
// Remove: these three files, their lines in hooks.server.ts / auth.ts / me / +layout.svelte / env.ts.

export const NOT_SAVED = 'Dev mode: not saved';
export const NOT_SAVED_HEADER = 'x-dev-not-saved';

export const devBypass = (hostname: string) =>
	dev &&
	!import.meta.env.PROD &&
	DEV_BYPASS_AUTH === 'true' &&
	(hostname === 'localhost' || hostname === '127.0.0.1');
