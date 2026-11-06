import { PRIVATE_PREFIXES } from '#lib/seo.ts';
import { tempGate } from '#lib/server/gate.ts';
import type { RequestHandler } from './$types';

// Generated so the Sitemap line carries this deployment's origin (pages.dev now, a custom domain later).
// TODO(before-deploy): restore full auth — while the temp gate is on, the whole site is disallowed.
export const GET: RequestHandler = ({ url }) =>
	new Response(
		[
			'User-agent: *',
			...(tempGate() ? ['Disallow: /'] : PRIVATE_PREFIXES.map((p) => `Disallow: ${p}`)),
			'',
			`Sitemap: ${url.origin}/sitemap.xml`,
			''
		].join('\n'),
		{
			headers: {
				'Content-Type': 'text/plain; charset=utf-8',
				'Cache-Control': 'public, max-age=86400'
			}
		}
	);
