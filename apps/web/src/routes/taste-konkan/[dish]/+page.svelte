<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { formatINR } from '#lib/format.ts';
	import Page from '#lib/components/Page.svelte';
	import Hero from '#lib/components/listing/Hero.svelte';
	import type { PageProps } from './$types';

	// FRONTEND §7.7 dish page: what it is → story → where it's best (linked eateries).
	let { data }: PageProps = $props();
	const d = $derived(data.dish);
	const lang = getLocale();
	const secondary = $derived(lang === 'en' ? d.names.mr : d.names.en);
</script>

<Page title={d.name} back description={d.what || d.story} image={d.photo?.src}>
	<article class="mx-auto flex max-w-[680px] flex-col gap-6">
		<Hero photo={d.photo} kind="dish" />
		<header>
			<h2 class="type-display">{d.name}</h2>
			{#if secondary && secondary !== d.name}<p
					class="type-h3 text-text-2"
					lang={lang === 'en' ? 'mr' : 'en'}
				>
					{secondary}
				</p>{/if}
		</header>
		{#if d.what}<section class="flex flex-col gap-2">
				<h2 class="type-h2">{m.dish_what()}</h2>
				<p class="type-body whitespace-pre-line">{d.what}</p>
			</section>{/if}
		{#if d.story}<section class="flex flex-col gap-2">
				<h2 class="type-h2">{m.dish_story()}</h2>
				<p class="type-body whitespace-pre-line">{d.story}</p>
			</section>{/if}
		<section class="flex flex-col gap-3">
			<h2 class="type-h2">{m.dish_where()}</h2>
			{#if d.eateries.length}
				<ul class="flex flex-col divide-y divide-border border-t border-text">
					{#each d.eateries as e (e.slug)}
						<li>
							<a
								href={resolve('/food/[slug]', { slug: e.slug })}
								class="row-link flex justify-between gap-3 py-3 text-text no-underline"
								><span class="type-body">{e.name}</span>{#if e.priceForTwo != null}<span
										class="type-small text-text-2"
										>{m.price_for_two({ price: formatINR(e.priceForTwo) })}</span
									>{/if}</a
							>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="type-body text-text-2">{m.dish_none()}</p>
			{/if}
		</section>
	</article>
</Page>
