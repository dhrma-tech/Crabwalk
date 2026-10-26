<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import { utilityIcons, type UtilityType } from '#lib/map/icons.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import NearbyList from '#lib/components/listing/NearbyList.svelte';
	import ItineraryList from '#lib/components/plan/ItineraryList.svelte';
	import type { PageProps } from './$types';

	// FRONTEND §7.17: "Start your Konkan trip" → ready-made itineraries + planner CTA. Tideline (T-30): a welcome
	// card naming the station/bus stand the visitor scanned at, the route cards, then what's near it.
	let { data }: PageProps = $props();
	const StopIcon = $derived(data.stop ? utilityIcons[data.stop.type as UtilityType] : null);
</script>

<Page title={m.start_title()} description={m.start_intro()}>
	<div class="flex flex-col gap-10 lg:gap-14">
		<section class="flex max-w-170 flex-col items-start gap-4 rounded-xl bg-lagoon-50 p-5 lg:p-8">
			{#if data.stop}
				<p
					class="inline-flex min-h-8 items-center gap-2 rounded-full bg-surface px-3 type-label text-lagoon-ink"
				>
					{#if StopIcon}<StopIcon size={16} aria-hidden="true" />{/if}
					{msg(`util_${data.stop.type}`)}{data.stop.name ? ` · ${data.stop.name}` : ''}
				</p>
			{/if}
			<p class="type-lead">{m.start_intro()}</p>
			<Button href={resolve('/plan/new')}>{m.start_plan()}</Button>
		</section>

		<section class="flex flex-col gap-3" data-testid="itineraries">
			<h2 class="type-h2">{m.start_itineraries()}</h2>
			{#if data.itineraries.length}
				<ItineraryList items={data.itineraries} />
			{:else}
				<EmptyState title={m.start_itineraries()} body={m.start_itineraries_empty()} />
			{/if}
		</section>

		{#if data.nearby && (data.nearby.listings.length || data.nearby.utilities.length)}
			<section class="flex max-w-170 flex-col gap-3">
				<h2 class="type-h2">{m.start_near()}</h2>
				<NearbyList listings={data.nearby.listings} utilities={data.nearby.utilities} />
			</section>
		{/if}
	</div>
</Page>
