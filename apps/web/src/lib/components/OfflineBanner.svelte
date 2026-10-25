<script lang="ts">
	import CloudOff from '@lucide/svelte/icons/cloud-off';
	import { m } from '#lib/paraglide/messages.js';
	import { onMount } from 'svelte';
	import { savedPacks } from '#lib/packs.ts';

	// FRONTEND §6.12: "You're offline — showing saved data" + taluka-pack status. Tideline: a caution pill under
	// the top bar (Report 2 §8).
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
		class="flex w-fit max-w-full items-center gap-2 rounded-lg bg-caution-50 px-4 py-2 type-small text-text shadow-e2 print:hidden"
		role="status"
	>
		<CloudOff size={18} aria-hidden="true" class="shrink-0 text-caution" />
		<span
			>{m.offline()} ·
			{packs.length ? m.offline_packs({ names: packs.join(', ') }) : m.offline_no_packs()}</span
		>
	</p>
{/if}
