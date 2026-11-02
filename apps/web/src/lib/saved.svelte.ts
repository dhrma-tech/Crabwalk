import { SvelteSet } from 'svelte/reactivity';
import { m } from '#lib/paraglide/messages.js';
import { loginHref } from '#lib/login.ts';
import { toast } from '#lib/toast.svelte.ts';

// Hearts on listing cards (DECISIONS T-5 / T-46): the signed-in visitor's saved listings, loaded once per page load
// from /api/saved (browser only), toggled optimistically and rolled back if the server says no. Guests → sign in.
export type SavedKind = 'place' | 'stay' | 'eatery';
const key = (t: SavedKind, slug: string) => `${t}/${slug}`;
const ids = new SvelteSet<string>();
let loading: Promise<boolean> | null = null;

// A guest has no Supabase auth cookie (@supabase/ssr sets it readable by scripts), so no request is made and no
// 401 lands in the console on every listing page.
const signedIn = () => document.cookie.includes('-auth-token');

/** Fetch the saved list once. Resolves false for a guest (no cookie or 401), and then retries next time. */
export function loadSaved() {
	if (!signedIn()) return Promise.resolve(false);
	loading ??= fetch('/api/saved')
		.then(async (r) => {
			if (!r.ok) {
				loading = null;
				return r.status !== 401;
			}
			for (const x of (await r.json()) as { type: SavedKind; slug: string }[])
				ids.add(key(x.type, x.slug));
			return true;
		})
		.catch(() => ((loading = null), true));
	return loading;
}

export const isSaved = (t: SavedKind, slug: string) => ids.has(key(t, slug));

export async function toggleSaved(t: SavedKind, slug: string) {
	if (!(await loadSaved())) return void (location.href = loginHref(location));
	const k = key(t, slug);
	const on = !ids.has(k);
	if (on) ids.add(k);
	else ids.delete(k);
	const r = await fetch(
		on ? '/api/saved' : `/api/saved?type=${t}&slug=${encodeURIComponent(slug)}`,
		on
			? {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ type: t, slug })
				}
			: { method: 'DELETE' }
	).catch(() => null);
	if (r?.ok) return;
	if (on) ids.delete(k);
	else ids.add(k);
	if (r?.status === 401) return void (location.href = loginHref(location));
	toast(m.send_failed());
}
