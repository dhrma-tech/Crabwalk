<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import Crabby from '#lib/components/CrabbyMark.svelte';
	import ErrorState from '#lib/components/ErrorState.svelte';
	import { ensureSession } from '#lib/guest.client.ts';
	import type { PageProps } from './$types';

	// Creates the guest session, then continues. `next` was validated on the server (same-origin path).
	let { data }: PageProps = $props();
	let failed = $state(false);

	async function start() {
		failed = false;
		// A full load, not goto(): the server must see the new auth cookie for every loader.
		if (await ensureSession()) location.replace(data.next);
		else failed = true;
	}
	onMount(start);
</script>

<Page title={m.guest_title()}>
	{#if failed}
		<ErrorState title={m.guest_failed()} body={m.guest_failed_hint()}>
			{#snippet action()}
				<Button onclick={start} data-testid="guest-retry">{m.try_again()}</Button>
			{/snippet}
		</ErrorState>
	{:else}
		<div class="flex flex-col items-center gap-4 py-16 text-center" role="status">
			<Crabby size={64} walking />
			<p class="type-body text-text-2">{m.guest_ready()}</p>
		</div>
	{/if}
	<noscript><p class="type-body text-text-2">{m.guest_noscript()}</p></noscript>
</Page>
