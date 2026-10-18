<script lang="ts">
	import WifiOff from '@lucide/svelte/icons/wifi-off';
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
		class="sticky top-0 z-40 flex items-center print:hidden justify-center gap-2 bg-sand-900 px-4 py-2 type-small text-sand-100"
		role="status"
	>
		<WifiOff size={20} aria-hidden="true" />{m.offline()} ·
		{packs.length ? m.offline_packs({ names: packs.join(', ') }) : m.offline_no_packs()}
	</p>
{/if}
