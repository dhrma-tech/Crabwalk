<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import Page from '#lib/components/Page.svelte';
	import StayCard from '#lib/components/StayCard.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import FilterBar from '#lib/components/listing/FilterBar.svelte';
	import type { PageProps } from './$types';

	// FRONTEND §7.5: filters (vibe, service style, price, amenities) → cards.
	let { data }: PageProps = $props();
	const vibes = [
		'traditional_konkani_home',
		'family',
		'luxury',
		'business',
		'backpacker',
		'couple_friendly',
		'pet_friendly',
		'beachfront',
		'orchard_stay'
	];
	const amenities = ['ac', 'hot_water', 'wifi', 'parking', 'power_backup'];
	const opt = (prefix: string, keys: string[]) =>
		keys.map((k) => ({ value: k, label: msg(`${prefix}${k}`) }));
</script>

<Page title={m.stays_title()}>
	<div class="flex flex-col gap-4">
		<FilterBar
			fields={[
				{
					name: 'vibe',
					label: m.filter_vibe(),
					value: data.filters.vibe,
					options: opt('vibe_', vibes)
				},
				{
					name: 'style',
					label: m.filter_style(),
					value: data.filters.style,
					options: opt('service_', ['homely', 'professional'])
				},
				{
					name: 'amenity',
					label: m.filter_amenity(),
					value: data.filters.amenity,
					options: opt('amenity_', amenities)
				},
				{
					name: 'max_price',
					label: m.filter_max_price(),
					value: data.filters.maxPrice,
					type: 'number'
				}
			]}
		/>
		{#if data.stays.length}
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.stays as s (s.slug)}
					<StayCard
						href={resolve('/stays/[slug]', { slug: s.slug })}
						names={s.names}
						photo={s.photo}
						tags={s.vibe_tags.map((v) => msg(`vibe_${v}`))}
						priceMin={s.price_min}
						priceMax={s.price_max}
						priceSource={s.price_source ? msg(`source_${s.price_source}`) : null}
						serviceStyle={s.service_style}
					/>
				{/each}
			</div>
		{:else}
			<EmptyState title={m.soon_title()} body={m.no_results()} />
		{/if}
	</div>
</Page>
