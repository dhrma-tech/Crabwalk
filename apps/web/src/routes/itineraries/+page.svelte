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
		{#if data.patterns.trending.length}
			<section class="flex flex-col gap-2" data-testid="trending">
				<h2 class="type-h2">{m.trending_title()}</h2>
				<ul class="flex flex-col gap-1">
					{#each data.patterns.trending as pair, i (i)}
						<li class="type-body">
							{#each pair as p, j (p.slug)}{#if j}
									→
								{/if}<a href={resolve('/place/[slug]', { slug: p.slug })}>{p.name}</a>{/each}
						</li>
					{/each}
				</ul>
			</section>
		{/if}
		{#if data.patterns.underrated.length}
			<section class="flex flex-col gap-2" data-testid="underrated">
				<h2 class="type-h2">{m.underrated_title()}</h2>
				<p class="type-small text-text-2">{m.underrated_hint()}</p>
				<ul class="flex flex-wrap gap-2">
					{#each data.patterns.underrated as p (p.slug)}
						<li>
							<a
								href={resolve('/place/[slug]', { slug: p.slug })}
								class="flex min-h-11 items-center border border-border bg-surface px-4 type-small no-underline"
								>{p.name}</a
							>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>
</Page>
