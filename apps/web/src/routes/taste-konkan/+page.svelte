<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import NoPhoto from '#lib/components/NoPhoto.svelte';
	import type { PageProps } from './$types';

	// FRONTEND §7.7: dish grid. Tideline (Report 2 §9.6): square photos with --r-lg and the name below, 2 across
	// on phones (more on wider screens); the dish no-photo tint when there is no photo.
	let { data }: PageProps = $props();
</script>

<Page title={m.taste_title()} description={m.meta_taste()}>
	{#if data.dishes.length}
		<ul class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
			{#each data.dishes as d (d.slug)}
				<li>
					<a
						href={resolve('/taste-konkan/[dish]', { dish: d.slug })}
						class="group flex flex-col gap-2 text-text no-underline"
						data-clip-check
					>
						<div
							class="aspect-square overflow-hidden rounded-lg bg-surface-2 bg-cover shadow-e1 transition-shadow duration-300 ease-brand group-hover:shadow-e2"
							style:background-image={d.photo?.lqip ? `url(${d.photo.lqip})` : undefined}
						>
							{#if d.photo}<img
									src={d.photo.src}
									srcset={d.photo.srcset}
									sizes="(min-width: 1024px) 280px, 50vw"
									alt={d.photo.alt}
									loading="lazy"
									class="h-full w-full object-cover transition-transform duration-300 ease-brand group-hover:scale-[1.03]"
								/>{:else}<NoPhoto kind="dish" label={false} />{/if}
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
