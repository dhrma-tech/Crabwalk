import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	signedIn: !!(await locals.getUser())
});
