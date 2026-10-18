<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import ItineraryList from '#lib/components/plan/ItineraryList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Page title={m.itin_title()}>
	<div class="mx-auto flex max-w-[680px] flex-col gap-4">
		{#if data.itineraries.length}
			<ItineraryList items={data.itineraries} />
		{:else}
			<EmptyState title={m.itin_title()} body={m.start_itineraries_empty()}>
				{#snippet action()}<Button href={resolve('/plan/new')}>{m.start_plan()}</Button>{/snippet}
			</EmptyState>
		{/if}
	</div>
</Page>
