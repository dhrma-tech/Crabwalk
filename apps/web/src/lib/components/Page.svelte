<script lang="ts">
	import type { Snippet } from 'svelte';
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
<main id="main" class="mx-auto w-full max-w-[1200px] px-6 pt-3 pb-8 lg:px-10 lg:pt-4">
	{@render children()}
</main>
