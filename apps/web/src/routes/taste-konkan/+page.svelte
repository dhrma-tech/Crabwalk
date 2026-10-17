<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
	import type { PageProps } from './$types';

	// FRONTEND §7.7: dish grid.
	let { data }: PageProps = $props();
</script>

<Page title={m.taste_title()}>
	{#if data.dishes.length}
		<ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
			{#each data.dishes as d (d.slug)}
				<li>
					<a
						href={resolve('/taste-konkan/[dish]', { dish: d.slug })}
						class="flex flex-col gap-2 text-text no-underline"
						data-clip-check
					>
						<div
							class="flex aspect-square items-center justify-center overflow-hidden rounded-card bg-sand-200 bg-cover text-text-2 dark:bg-raised"
							style:background-image={d.photo?.lqip ? `url(${d.photo.lqip})` : undefined}
						>
							{#if d.photo}<img
									src={d.photo.src}
									srcset={d.photo.srcset}
									sizes="(min-width: 1024px) 280px, 50vw"
									alt={d.photo.alt}
									loading="lazy"
									class="h-full w-full object-cover"
								/>{:else}<UtensilsCrossed size={40} aria-hidden="true" />{/if}
						</div>
						<span class="type-h3">{d.name}</span>
						{#if d.what}<span class="line-clamp-2 type-small text-text-2">{d.what}</span>{/if}
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<EmptyState title={m.soon_title()} body={m.dish_none()} />
	{/if}
</Page>
