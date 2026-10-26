<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import Page from '#lib/components/Page.svelte';
	import MiniVerdict from '#lib/components/rating/MiniVerdict.svelte';
	import EateryCard from '#lib/components/EateryCard.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import InsetList from '#lib/components/InsetList.svelte';
	import ListControls from '#lib/components/listing/ListControls.svelte';
	import Button from '#lib/components/Button.svelte';
	import type { PageProps } from './$types';

	// FRONTEND §7.6: filters (veg, authenticity, price) → cards. Report 2 §9.4 (T-27): sticky chips + count +
	// sort; inset rows on phones, a 3-up card grid on laptops.
	let { data }: PageProps = $props();
	const dietMap = { veg: 'veg', non_veg: 'nonveg', jain: 'jain' } as const;
</script>

{#snippet card(e: (typeof data.eateries)[number], row: boolean)}
	<EateryCard
		{row}
		level={2}
		href={resolve('/food/[slug]', { slug: e.slug })}
		names={e.names}
		photo={e.photo}
		authenticity={e.authenticity ? msg(`auth_${e.authenticity}`) : null}
		signatureDish={e.signature}
		priceForTwo={e.priceForTwo}
		diet={e.diet.map((d) => dietMap[d])}
	>
		{#snippet verdict()}<MiniVerdict type="eatery" agg={e.agg} />{/snippet}
	</EateryCard>
{/snippet}

<Page title={m.food_title()} description={m.meta_food()}>
	<div class="flex flex-col gap-4">
		<ListControls
			count={data.eateries.length}
			sort={data.sort}
			fields={[
				{
					name: 'diet',
					label: m.filter_diet(),
					value: data.filters.diet,
					options: [
						{ value: 'veg', label: m.diet_veg() },
						{ value: 'non_veg', label: m.diet_nonveg() },
						{ value: 'jain', label: m.diet_jain() }
					]
				},
				{
					name: 'authenticity',
					label: m.filter_authenticity(),
					value: data.filters.authenticity,
					options: ['home_style', 'local_legend', 'tourist_oriented'].map((k) => ({
						value: k,
						label: msg(`auth_${k}`)
					}))
				},
				{
					name: 'max_price',
					label: m.filter_max_price(),
					value: data.filters.maxPrice,
					type: 'number'
				}
			]}
		/>
		{#if data.eateries.length}
			<div class="lg:hidden">
				<InsetList>
					{#each data.eateries as e (e.slug)}
						{@render card(e, true)}
					{/each}
				</InsetList>
			</div>
			<div class="hidden gap-5 lg:grid lg:grid-cols-3">
				{#each data.eateries as e (e.slug)}
					{@render card(e, false)}
				{/each}
			</div>
		{:else}
			<EmptyState title={m.soon_title()} body={m.no_results()}>
				{#snippet action()}<Button href={resolve('/food')} variant="secondary"
						>{m.filters_clear_all()}</Button
					>{/snippet}
			</EmptyState>
		{/if}
	</div>
</Page>
