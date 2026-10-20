<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { onMount } from 'svelte';
	import { savedPacks } from '#lib/packs.ts';

	// FRONTEND §6.12: "You're offline — showing saved data" + taluka-pack status.
	let online = $state(true);
	let packs = $state<string[]>([]);
	onMount(() => {
		online = navigator.onLine;
		const update = async () => {
			online = navigator.onLine;
			if (!online) packs = Object.values(await savedPacks()).map((p) => p.name);
		};
		update();
		addEventListener('online', update);
		addEventListener('offline', update);
		return () => {
			removeEventListener('online', update);
			removeEventListener('offline', update);
		};
	});
</script>

{#if !online}
	<p
		class="sticky top-0 z-banner bg-yama px-6 py-2.5 type-small text-text print:hidden"
		role="status"
	>
		{m.offline()} ·
		{packs.length ? m.offline_packs({ names: packs.join(', ') }) : m.offline_no_packs()}
	</p>
{/if}
