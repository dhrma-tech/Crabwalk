<script lang="ts">
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';

	// Title, description and share card for every page (search results, link previews).
	// `image`: a listing's own photo when it has one — never a stock image; otherwise the app icon.
	let {
		title,
		description,
		image
	}: { title: string; description?: string | null; image?: string | null } = $props();

	const full = $derived(title === m.app_name() ? title : `${title} · ${m.app_name()}`);
	const desc = $derived(
		(description || m.meta_default()).replace(/\s+/g, ' ').trim().slice(0, 160)
	);
	const url = $derived(page.url.origin + page.url.pathname);
	const img = $derived(image || `${page.url.origin}/icons/icon-512.png`);
	const locale = { en: 'en_IN', hi: 'hi_IN', mr: 'mr_IN' }[getLocale()];
</script>

<svelte:head>
	<title>{full}</title>
	<meta name="description" content={desc} />
	<link rel="canonical" href={url} />
	<meta property="og:site_name" content={m.app_name()} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={full} />
	<meta property="og:description" content={desc} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={img} />
	<meta property="og:locale" content={locale} />
	<meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
</svelte:head>
