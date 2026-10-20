<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { msg } from '#lib/msg.ts';
	import { formatNumber } from '#lib/format.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import ItineraryList from '#lib/components/plan/ItineraryList.svelte';
	import type { PageProps } from './$types';

	// FRONTEND §7.17: "Start your Konkan trip" → ready-made itineraries + planner CTA.
	let { data }: PageProps = $props();
	const lang = getLocale();
	const hrefFor = (kind: string, slug: string) =>
		kind === 'stay' ? resolve('/stays/[slug]', { slug }) : resolve('/food/[slug]', { slug });
	const pinName = (x: {
		name_en: string | null;
		name_hi: string | null;
		name_mr: string | null;
		slug: string;
	}) => (lang === 'hi' ? x.name_hi : lang === 'mr' ? x.name_mr : null) || x.name_en || x.slug;
</script>

<Page title={m.start_title()} description={m.start_intro()}>
	<div class="mx-auto flex max-w-[680px] flex-col gap-6">
		<section class="flex flex-col gap-3">
			{#if data.stop}<p class="type-body text-text-2">
					{msg(`util_${data.stop.type}`)}{data.stop.name ? ` · ${data.stop.name}` : ''}
				</p>{/if}
			<p class="type-body">{m.start_intro()}</p>
			<div><Button href={resolve('/plan/new')}>{m.start_plan()}</Button></div>
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
			<section class="flex flex-col gap-3">
				<h2 class="type-h2">{m.start_near()}</h2>
				<ul class="flex flex-col divide-y divide-border border-t border-text">
					{#each data.nearby.listings as x (x.id)}
						<li>
							<a
								href={hrefFor(x.kind, x.slug)}
								class="flex justify-between gap-3 py-3 text-text no-underline"
								><span class="type-body">{pinName(x)}</span><span class="type-small text-text-2"
									>{m.km_away({ km: formatNumber(x.km) })}</span
								></a
							>
						</li>
					{/each}
					{#each data.nearby.utilities as u (u.id)}
						<li class="flex justify-between gap-3 py-3">
							<span class="type-body">{msg(`util_${u.type}`)}{u.name ? ` · ${u.name}` : ''}</span
							><span class="type-small text-text-2">{m.km_away({ km: formatNumber(u.km) })}</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>
</Page>
