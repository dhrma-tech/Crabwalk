<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import TopBar from './TopBar.svelte';
	import Meta from './Meta.svelte';

	let {
		title,
		back = false,
		description,
		image,
		canonical,
		heading = page.url.pathname !== '/',
		overlay = false,
		children
	}: {
		title: string;
		back?: boolean;
		description?: string | null;
		image?: string | null;
		/** Path (+ query) when the canonical URL is not just the pathname, e.g. a Discover category. */
		canonical?: string;
		/** Show the h1 on laptops (default: every page but Discover, whose heading is the wordmark). */
		heading?: boolean;
		/** Phones: transparent top bar over a full-bleed hero (detail pages). */
		overlay?: boolean;
		children: Snippet;
	} = $props();
</script>

<Meta {title} {description} {image} {canonical} />
<TopBar {title} {back} {overlay} />
<!-- The page heading (T-21): phones show the title in the top bar, laptops above the content. -->
<main id="main" class="mx-auto w-full max-w-300 px-5 pt-2 pb-10 lg:px-8 lg:pt-6">
	<h1 class={['sr-only', heading && 'lg:not-sr-only lg:mb-6 lg:type-h1']}>
		{title}
	</h1>
	{@render children()}
</main>
