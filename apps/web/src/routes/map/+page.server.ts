import type { Pin } from '#lib/components/map/MapView.svelte';
import type { PageServerLoad } from './$types';

// ?focus=<kind>/<slug> (place → map hand-off, Report 1 §4.3): open on that pin with its sheet at half height.
export const load: PageServerLoad = async ({ locals, url, fetch }) => {
	const [kind, slug] = (url.searchParams.get('focus') ?? '').split('/');
	const focus =
		kind && slug
			? await fetch(`/api/map/pin?${new URLSearchParams({ kind, slug })}`)
					.then((r) => (r.ok ? (r.json() as Promise<Pin>) : null))
					.catch(() => null)
			: null;
	return { signedIn: !!(await locals.getUser()), focus };
};
