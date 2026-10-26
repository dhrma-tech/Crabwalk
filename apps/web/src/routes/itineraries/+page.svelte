<script lang="ts">
	import Route from '@lucide/svelte/icons/route';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import InsetList from '#lib/components/InsetList.svelte';
	import ItineraryList from '#lib/components/plan/ItineraryList.svelte';
	import type { PageProps } from './$types';

	// Ready-made itineraries + route patterns (P9). Tideline (T-30): the Discover route cards (2/3-up), trending
	// pairs as an inset list, underrated places as chips; side by side on laptops.
	let { data }: PageProps = $props();
</script>

<Page title={m.itin_title()} description={m.meta_itineraries()}>
	<div class="flex flex-col gap-10 lg:gap-14">
		{#if data.itineraries.length}
			<ItineraryList items={data.itineraries} />
		{:else}
			<EmptyState title={m.itin_title()} body={m.start_itineraries_empty()}>
				{#snippet action()}<Button href={resolve('/plan/new')}>{m.start_plan()}</Button>{/snippet}
			</EmptyState>
		{/if}
		{#if data.patterns.trending.length || data.patterns.underrated.length}
			<div class="grid gap-10 lg:grid-cols-2 lg:gap-10">
				{#if data.patterns.trending.length}
					<section class="flex flex-col gap-3" data-testid="trending">
						<h2 class="type-h2">{m.trending_title()}</h2>
						<InsetList>
							{#each data.patterns.trending as pair, i (i)}
								<div class="flex min-h-14 items-center gap-3 px-4 py-2.5 type-body">
									<span
										class="flex size-10 shrink-0 items-center justify-center rounded-md bg-lagoon-50 text-lagoon-ink"
										><Route size={20} aria-hidden="true" /></span
									>
									<span
										>{#each pair as p, j (p.slug)}{#if j}
												<span aria-hidden="true">→</span>
											{/if}<a href={resolve('/place/[slug]', { slug: p.slug })}>{p.name}</a
											>{/each}</span
									>
								</div>
							{/each}
						</InsetList>
					</section>
				{/if}
				{#if data.patterns.underrated.length}
					<section class="flex flex-col gap-3" data-testid="underrated">
						<h2 class="type-h2">{m.underrated_title()}</h2>
						<p class="type-small text-text-2">{m.underrated_hint()}</p>
						<ul class="flex flex-wrap gap-2">
							{#each data.patterns.underrated as p (p.slug)}
								<li>
									<a
										href={resolve('/place/[slug]', { slug: p.slug })}
										class="group inline-flex min-h-11 items-center no-underline"
									>
										<span
											class="inline-flex min-h-9 items-center rounded-full bg-surface-2 px-3.5 py-1 type-label text-text transition-colors duration-200 group-hover:bg-surface-3"
											>{p.name}</span
										>
									</a>
								</li>
							{/each}
						</ul>
					</section>
				{/if}
			</div>
		{/if}
	</div>
</Page>
