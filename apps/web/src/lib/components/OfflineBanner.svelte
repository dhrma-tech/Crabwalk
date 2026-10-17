<script lang="ts">
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import { m } from '#lib/paraglide/messages.js';
	import { onMount } from 'svelte';

	// FRONTEND §6.12. Taluka-pack status is added with packs in P9.
	let online = $state(true);
	onMount(() => {
		online = navigator.onLine;
		const update = () => (online = navigator.onLine);
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
		class="sticky top-0 z-40 flex items-center justify-center gap-2 bg-sand-900 px-4 py-2 type-small text-sand-100"
		role="status"
	>
		<WifiOff size={20} aria-hidden="true" />{m.offline()}
	</p>
{/if}
