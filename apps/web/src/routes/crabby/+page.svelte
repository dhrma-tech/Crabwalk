<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import TopBar from '#lib/components/TopBar.svelte';
	import CrabbyChat from '#lib/components/crabby/CrabbyChat.svelte';
	import { ask } from '#lib/crabby.svelte.ts';
	import Meta from '#lib/components/Meta.svelte';

	// FRONTEND §7.13 / §6.7. ?ask= sends a prompt chip picked elsewhere (place page bubble).
	onMount(() => {
		const q = page.url.searchParams.get('ask');
		if (q) ask(q);
	});
</script>

<Meta title={m.nav_crabby()} />
<TopBar title={m.nav_crabby()} />
<main
	id="main"
	class="mx-auto flex h-[calc(100dvh-var(--bar-h)-var(--nav-h)-env(safe-area-inset-top))] w-full max-w-[760px] flex-col"
>
	<h1 class="sr-only">{m.nav_crabby()}</h1>
	<CrabbyChat chips={[m.crabby_chip_plan(), m.crabby_chip_gems(), m.crabby_chip_food()]} />
</main>
