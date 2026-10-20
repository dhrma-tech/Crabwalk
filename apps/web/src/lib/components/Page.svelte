<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import TopBar from './TopBar.svelte';

	let {
		title,
		back = false,
		children
	}: { title: string; back?: boolean; children: Snippet } = $props();
</script>

<svelte:head
	><title>{title === m.app_name() ? title : `${title} · ${m.app_name()}`}</title></svelte:head
>

<TopBar {title} {back} />
<main id="main" class="mx-auto w-full max-w-[1200px] px-6 pt-3 pb-8 lg:px-10 lg:pt-4">
	{@render children()}
</main>
