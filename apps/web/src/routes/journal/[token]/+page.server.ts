import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// A shared trip journal (P12 step M): only when its owner turned the link on and the story is written.
export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
	if (!/^[\w-]{16,64}$/.test(params.token)) error(404, 'not found');
	const { data } = await locals.supabase.rpc('journal_by_token', { _token: params.token });
	const j = data?.[0];
	if (!j) error(404, 'not found');
	setHeaders({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' });
	return { journal: { ...j, photos: j.photos as { path: string; caption: string | null }[] } };
};
