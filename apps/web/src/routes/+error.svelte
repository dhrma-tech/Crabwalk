<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import ErrorState from '#lib/components/ErrorState.svelte';
	import Button from '#lib/components/Button.svelte';

	const notFound = $derived(page.status === 404);
</script>

<Page title={m.app_name()} back>
	{#if notFound}
		<ErrorState title={m.not_found_title()} body={m.not_found_body()} tone="fuji">
			{#snippet action()}<Button href={resolve('/')}>{m.go_discover()}</Button>{/snippet}
		</ErrorState>
	{:else}
		<ErrorState title={m.error_title()} body={m.error_body()}>
			{#snippet action()}<Button onclick={() => location.reload()}>{m.try_again()}</Button
				>{/snippet}
		</ErrorState>
	{/if}
</Page>
