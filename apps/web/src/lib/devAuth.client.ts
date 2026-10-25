import { toast } from '#lib/toast.svelte.ts';
import { NOT_SAVED, NOT_SAVED_HEADER } from '#lib/devAuth.ts';

/** Client: console warning, and a toast whenever a write was skipped. Returns cleanup. */
export function devClient() {
	console.warn('DEV AUTH BYPASS ACTIVE');
	if (location.hash === '#dev-not-saved') {
		toast(NOT_SAVED);
		history.replaceState(history.state, '', location.pathname + location.search);
	}
	const realFetch = window.fetch;
	window.fetch = async (...args) => {
		const res = await realFetch(...args);
		if (res.headers.has(NOT_SAVED_HEADER)) toast(NOT_SAVED);
		return res;
	};
	return () => {
		window.fetch = realFetch;
	};
}
