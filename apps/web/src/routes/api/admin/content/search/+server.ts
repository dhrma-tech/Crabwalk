import { error, json } from '@sveltejs/kit';
import { adminEditor, search } from '#lib/server/content.ts';
import type { RequestHandler } from './$types';

// Searchable picker for dish ↔ eatery links: GET ?kind=dish|eatery&q=…
export const GET: RequestHandler = async (event) => {
	await adminEditor(event);
	const kind = event.url.searchParams.get('kind');
	if (kind !== 'dish' && kind !== 'eatery') error(400, 'kind');
	return json(await search(kind, (event.url.searchParams.get('q') ?? '').slice(0, 80)));
};
