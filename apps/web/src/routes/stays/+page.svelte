<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import { AMENITIES, VIBES } from '#lib/vocab.ts';
	import Page from '#lib/components/Page.svelte';
	import MiniVerdict from '#lib/components/rating/MiniVerdict.svelte';
	import StayCard from '#lib/components/StayCard.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Button from '#lib/components/Button.svelte';
	import InsetList from '#lib/components/InsetList.svelte';
	import ListControls from '#lib/components/listing/ListControls.svelte';
	import type { PageProps } from './$types';

	// FRONTEND §7.5: filters (vibe, service style, price, amenities) → cards. Report 2 §9.4: sticky chip bar +
	// count + sort; inset rows on phones, a 3-up card grid on laptops (both rendered, CSS picks one).
	let { data }: PageProps = $props();
	const opt = (prefix: string, keys: readonly string[]) =>
		keys.map((k) => ({ value: k, label: msg(`${prefix}${k}`) }));
</script>

{#snippet card(s: (typeof data.stays)[number], row: boolean)}
	<StayCard
		{row}
		level={2}
		href={resolve('/stays/[slug]', { slug: s.slug })}
		names={s.names}
		photo={s.photo}
		tags={s.vibe_tags.map((v) => msg(`vibe_${v}`))}
		priceMin={s.price_min}
		priceMax={s.price_max}
		priceSource={s.price_source ? msg(`source_${s.price_source}`) : null}
		serviceStyle={s.service_style}
	>
		{#snippet verdict()}<MiniVerdict type="stay" agg={s.agg} />{/snippet}
	</StayCard>
{/snippet}

<Page title={m.stays_title()} description={m.meta_stays()}>
	<div class="flex flex-col gap-4">
		<ListControls
			count={data.stays.length}
			sort={data.sort}
			fields={[
				{
					name: 'vibe',
					label: m.filter_vibe(),
					value: data.filters.vibe,
					options: opt('vibe_', VIBES)
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
					options: opt('amenity_', AMENITIES)
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
			<div class="lg:hidden">
				<InsetList>
					{#each data.stays as s (s.slug)}
						{@render card(s, true)}
					{/each}
				</InsetList>
			</div>
			<div class="hidden gap-5 lg:grid lg:grid-cols-3">
				{#each data.stays as s (s.slug)}
					{@render card(s, false)}
				{/each}
			</div>
		{:else}
			<!-- Report 1 §4.1: one helpful action. -->
			<EmptyState title={m.soon_title()} body={m.no_results()}>
				{#snippet action()}<Button href={resolve('/stays')} variant="secondary"
						>{m.filters_clear_all()}</Button
					>{/snippet}
			</EmptyState>
		{/if}
	</div>
</Page>
