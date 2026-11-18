import { error } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

// Hardening T1-10 (UX-11): the only way out to a booking site. Looks up the offer of a published stay (RLS) and
// answers 303 to its stored https link; never takes a URL from the request.
export const GET: RequestHandler = async ({ params, locals }) => {
	const id = z.uuid().safeParse(params.offer);
	if (!id.success) error(404, 'not found');
	const { data } = await locals.supabase
		.from('stay_offers')
		.select('deep_link')
		.eq('id', id.data)
		.maybeSingle();
	if (!data?.deep_link.startsWith('https://')) error(404, 'not found');
	return new Response(null, {
		status: 303,
		headers: {
			location: data.deep_link,
			'cache-control': 'no-store',
			'referrer-policy': 'no-referrer'
		}
	});
};
