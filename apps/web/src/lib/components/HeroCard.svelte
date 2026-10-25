<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import type { Names, Photo } from './ListingCard.svelte';
	import type { Category } from './CategoryIcon.svelte';
	import NoPhoto, { type Kind } from './NoPhoto.svelte';

	// Hero carousel card (Report 2 §8; Hidden gems, itineraries): 280×360 full-bleed photo, bottom scrim, white
	// display name, glass badges. With no photo the designed no-photo card shows and the text stays ink (no
	// scrim over a light tint). Grows taller rather than clipping long Marathi names. Sits in a Carousel.
	let {
		href,
		photo,
		names,
		category,
		kind,
		sub,
		badges
	}: {
		href: string;
		photo?: Photo | null;
		names: Names;
		category?: Category;
		kind?: Kind;
		/** One short line under the name, e.g. "3 days · Family". */
		sub?: string | null;
		badges?: Snippet;
	} = $props();

	const locale = getLocale();
	const name = $derived(
		(locale === 'hi' ? names.hi : locale === 'mr' ? names.mr : null) || names.en
	);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass resolve()d hrefs -->
<a
	{href}
	class="group relative flex h-full min-h-90 flex-col justify-between overflow-hidden rounded-lg bg-surface-2 bg-cover bg-center text-text no-underline shadow-e1 transition-shadow duration-300 ease-brand hover:shadow-e2"
	style:background-image={photo?.lqip ? `url(${photo.lqip})` : undefined}
	data-clip-check
>
	<div class="absolute inset-0" aria-hidden={!photo || undefined}>
		{#if photo}
			<img
				src={photo.src}
				srcset={photo.srcset}
				sizes="(min-width: 1024px) 300px, 280px"
				alt={photo.alt}
				loading="lazy"
				decoding="async"
				class="h-full w-full object-cover transition-transform duration-300 ease-brand group-hover:scale-[1.03]"
			/>
			<div class="absolute inset-0 bg-[linear-gradient(transparent_40%,rgba(0,0,0,.55))]"></div>
		{:else}
			<NoPhoto {category} {kind} label={false} />
		{/if}
	</div>
	<div class="relative flex flex-wrap gap-1.5 p-3">{@render badges?.()}</div>
	<div class={['relative flex flex-col gap-1 p-4', photo && 'text-white']}>
		<h3 class="type-display break-words lg:type-h1">{name}</h3>
		{#if sub}<p class={['type-small', photo ? 'text-white' : 'text-text-2']}>{sub}</p>{/if}
	</div>
</a>
