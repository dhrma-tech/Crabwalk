import { error } from '@sveltejs/kit';
import { dev } from '$app/env';

// Component gallery for visual/clipping tests. Never served by a production build
// (only `vite dev` or `vite build --mode e2e`), so its sample data can't pass as real.
export const load = () => {
	if (!dev && import.meta.env.MODE !== 'e2e') error(404);
};
