import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';

// P10 CSP (BACKEND §14): hashes/nonces for SvelteKit's own inline scripts; Supabase + tiles hosts only.
// Dev/e2e builds also allow the local stack (Supabase :54321 incl. the Realtime socket, tile server :4174).
// Hardening 2026-11 (SEC-10): the exact Supabase and tiles origins from the build environment, never a wildcard;
// a production build without them stops. Violations are reported to /api/csp-report.
type Csp = NonNullable<NonNullable<Parameters<typeof sveltekit>[0]>['csp']>;
const csp = (mode: string, env: Record<string, string | undefined>): Csp => {
	const origin = (name: string) => {
		const v = env[name];
		if (v) return [new URL(v).origin];
		if (mode === 'production')
			throw new Error(
				`${name} must be set when building for production: the CSP names its exact host (SEC-10).`
			);
		return [];
	};
	const api = origin('SUPABASE_URL');
	const tiles = origin('PMTILES_BASE_URL');
	const local =
		mode === 'production'
			? []
			: [
					'http://127.0.0.1:54321',
					'http://localhost:54321',
					'http://localhost:4174',
					'ws://localhost:*',
					'ws://127.0.0.1:54321' // Realtime (P11 plan workspace)
				];
	// Realtime (plan workspace) uses the same host over a websocket.
	const supabase = [...api, ...api.map((o) => o.replace(/^http/, 'ws'))];
	return {
		mode: 'auto' as const,
		directives: {
			'default-src': ['self' as const],
			// Cloudflare Turnstile (SEC-02): the challenge script and its iframe, nothing else third-party.
			'script-src': ['self' as const, 'https://challenges.cloudflare.com'],
			'frame-src': ['https://challenges.cloudflare.com'],
			'style-src': ['self' as const, 'unsafe-inline' as const],
			'img-src': ['self' as const, 'data:', 'blob:', ...api, ...local],
			'media-src': ['self' as const, ...api, ...local],
			'font-src': ['self' as const],
			'connect-src': ['self' as const, ...supabase, ...tiles, ...local],
			'worker-src': ['self' as const, 'blob:'],
			'frame-ancestors': ['none' as const],
			'object-src': ['none' as const],
			'base-uri': ['self' as const],
			// Google sign-in redirects through Supabase to Google.
			'form-action': ['self' as const, ...api, 'https://accounts.google.com', ...local],
			'report-uri': ['/api/csp-report'],
			...(mode === 'production' ? { 'upgrade-insecure-requests': true } : {})
		} as Csp['directives']
	};
};

export default defineConfig(({ mode }) => {
	// The repo-root .env (same place as the app's env dir) for local production builds; the shell wins.
	const env = { ...loadEnv(mode, '../../', ''), ...process.env };
	return {
		plugins: [
			tailwindcss(),
			paraglideVitePlugin({
				project: './project.inlang',
				outdir: './src/lib/paraglide',
				// FRONTEND §10: saved choice → phone languages → English.
				strategy: ['cookie', 'preferredLanguage', 'baseLocale'],
				emitTsDeclarations: true // keep in sync with the `i18n` script
			}),
			// Staff/owner strings: own catalogue, loaded only with those routes (src/lib/staff-messages.ts).
			paraglideVitePlugin({
				project: './project.staff.inlang',
				outdir: './src/lib/paraglide-staff',
				strategy: ['cookie', 'preferredLanguage', 'baseLocale'],
				emitTsDeclarations: true // keep in sync with the `i18n` script
			}),
			sveltekit({
				compilerOptions: {
					// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},
				adapter: adapter(),
				// Step G (Report 1 §3.4): inline the tiny per-component CSS files (Button, StatusBadge, Skeleton,
				// NoPhoto: < 0.5 KB each) instead of one render-blocking request each; the 57 KB app CSS stays cached.
				inlineStyleThreshold: 1024,
				env: { dir: '../../' },
				csp: csp(mode, env)
			})
		],
		test: {
			expect: { requireAssertions: true },
			projects: [
				{
					extends: './vite.config.ts',
					test: {
						name: 'server',
						environment: 'node',
						include: ['src/**/*.{test,spec}.{js,ts}'],
						exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
					}
				}
			]
		}
	};
});
