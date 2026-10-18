<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import TopBar from '#lib/components/TopBar.svelte';
	import CrabbyChat from '#lib/components/crabby/CrabbyChat.svelte';
	import { ask } from '#lib/crabby.svelte.ts';

	// FRONTEND §7.13 / §6.7. ?ask= sends a prompt chip picked elsewhere (place page bubble).
	onMount(() => {
		const q = page.url.searchParams.get('ask');
		if (q) ask(q);
	});
</script>

<svelte:head><title>{m.nav_crabby()} · {m.app_name()}</title></svelte:head>
<TopBar title={m.nav_crabby()} />
<main
	id="main"
	class="mx-auto flex h-[calc(100dvh-56px-64px-env(safe-area-inset-bottom))] w-full max-w-[760px] flex-col lg:h-[calc(100dvh-56px)]"
>
	<CrabbyChat chips={[m.crabby_chip_plan(), m.crabby_chip_gems(), m.crabby_chip_food()]} />
</main>
