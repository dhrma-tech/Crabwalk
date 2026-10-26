<script lang="ts">
	import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { formatINR } from '#lib/format.ts';
	import Page from '#lib/components/Page.svelte';
	import InsetList from '#lib/components/InsetList.svelte';
	import Hero from '#lib/components/listing/Hero.svelte';
	import type { PageProps } from './$types';

	// FRONTEND §7.7 dish page: what it is → story → where it's best (linked eateries). Tideline (Report 2 §9.6):
	// the immersive hero (T-25) and a reading column; eateries as an inset list, best picks first and labelled.
	let { data }: PageProps = $props();
	const d = $derived(data.dish);
	const lang = getLocale();
	const secondary = $derived(lang === 'en' ? d.names.mr : d.names.en);
</script>

<Page
	title={d.name}
	back
	overlay
	heading={false}
	description={d.what || d.story}
	image={d.photo?.src}
>
	<Hero photo={d.photo} kind="dish" immersive />

	<article
		class="relative -mx-5 -mt-7 flex flex-col gap-8 rounded-t-xl bg-bg px-5 pt-6 lg:mx-auto lg:mt-8 lg:max-w-170 lg:rounded-none lg:px-0 lg:pt-0"
	>
		<header>
			<h2 class="type-display">{d.name}</h2>
			{#if secondary && secondary !== d.name}<p
					class="mt-1 type-small text-text-2"
					lang={lang === 'en' ? 'mr' : 'en'}
				>
					{secondary}
				</p>{/if}
		</header>
		{#if d.what}<section class="flex flex-col gap-3">
				<h2 class="type-h2">{m.dish_what()}</h2>
				<p class="type-lead whitespace-pre-line">{d.what}</p>
			</section>{/if}
		{#if d.story}<section class="flex flex-col gap-3">
				<h2 class="type-h2">{m.dish_story()}</h2>
				<p class="type-body whitespace-pre-line text-text-2">{d.story}</p>
			</section>{/if}
		<section class="flex flex-col gap-3">
			<h2 class="type-h2">{m.dish_where()}</h2>
			{#if d.eateries.length}
				<InsetList>
					{#each d.eateries as e (e.slug)}
						<a
							href={resolve('/food/[slug]', { slug: e.slug })}
							class="row-link flex min-h-14 items-center gap-3 px-4 py-2.5 text-text no-underline"
						>
							<span
								class="flex size-10 shrink-0 items-center justify-center rounded-md bg-alphonso-50 text-alphonso-ink"
								><UtensilsCrossed size={20} aria-hidden="true" /></span
							>
							<span class="flex min-w-0 flex-1 flex-col">
								<span class="type-body-strong">{e.name}</span>
								<span class="type-small text-text-2">
									{[
										e.best ? m.dish_best_here() : null,
										e.priceForTwo != null
											? m.price_for_two({ price: formatINR(e.priceForTwo) })
											: null
									]
										.filter(Boolean)
										.join(' · ')}
								</span>
							</span>
							<ChevronRight size={20} aria-hidden="true" class="text-text-2" />
						</a>
					{/each}
				</InsetList>
			{:else}
				<p class="type-body text-text-2">{m.dish_none()}</p>
			{/if}
		</section>
	</article>
</Page>
