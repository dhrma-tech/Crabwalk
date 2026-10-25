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
		children
	}: {
		title: string;
		back?: boolean;
		description?: string | null;
		image?: string | null;
		children: Snippet;
	} = $props();
</script>

<Meta {title} {description} {image} />
<TopBar {title} {back} />
<!-- The page heading (T-21): phones show the title in the top bar, laptops above the content. -->
<main id="main" class="mx-auto w-full max-w-300 px-5 pt-2 pb-10 lg:px-8 lg:pt-6">
	<h1 class={['sr-only', page.url.pathname !== '/' && 'lg:not-sr-only lg:mb-6 lg:type-h1']}>
		{title}
	</h1>
	{@render children()}
</main>
