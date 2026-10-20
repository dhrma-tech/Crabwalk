import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';

// P10 CSP (BACKEND §14): hashes/nonces for SvelteKit's own inline scripts; Supabase + tiles hosts only.
// Dev/e2e builds also allow the local stack (Supabase :54321, tile server :4174).
type Csp = NonNullable<NonNullable<Parameters<typeof sveltekit>[0]>['csp']>;
const csp = (mode: string): Csp => {
	const local =
		mode === 'production'
			? []
			: [
					'http://127.0.0.1:54321',
					'http://localhost:54321',
					'http://localhost:4174',
					'ws://localhost:*'
				];
	const supabase = ['https://*.supabase.co', 'wss://*.supabase.co'];
	return {
		mode: 'auto' as const,
		directives: {
			'default-src': ['self' as const],
			'script-src': ['self' as const],
			'style-src': ['self' as const, 'unsafe-inline' as const],
			'img-src': ['self' as const, 'data:', 'blob:', 'https://*.supabase.co', ...local],
			'media-src': ['self' as const, 'https://*.supabase.co', ...local],
			'font-src': ['self' as const],
			'connect-src': ['self' as const, ...supabase, 'https://*.pages.dev', ...local],
			'worker-src': ['self' as const, 'blob:'],
			'frame-ancestors': ['none' as const],
			'object-src': ['none' as const],
			'base-uri': ['self' as const],
			// Google sign-in redirects through Supabase to Google.
			'form-action': [
				'self' as const,
				'https://*.supabase.co',
				'https://accounts.google.com',
				...local
			],
			...(mode === 'production' ? { 'upgrade-insecure-requests': true } : {})
		} as Csp['directives']
	};
};

export default defineConfig(({ mode }) => ({
	plugins: [
		tailwindcss(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			// FRONTEND §10: saved choice → phone languages → English.
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
			env: { dir: '../../' },
			csp: csp(mode)
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
}));
