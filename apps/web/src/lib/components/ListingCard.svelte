<script lang="ts" module>
	export type Photo = { src: string; srcset?: string; alt: string; lqip?: string };
	export type Names = { en: string; hi?: string | null; mr?: string | null };
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import Heart from '@lucide/svelte/icons/heart';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import CategoryIcon, { type Category } from './CategoryIcon.svelte';

	// Shared shell for Place/Stay/Eatery cards (FRONTEND §6.3): 4:3 photo, heart, bilingual name, body.
	let {
		href,
		photo,
		names,
		fallbackCategory,
		saved = false,
		onsave,
		children
	}: {
		href: string;
		photo?: Photo | null;
		names: Names;
		fallbackCategory?: Category;
		saved?: boolean;
		onsave?: () => void;
		children?: Snippet;
	} = $props();

	// Primary language on top, the other script below (§2.3).
	const locale = getLocale();
	const primary = $derived(
		(locale === 'hi' ? names.hi : locale === 'mr' ? names.mr : null) || names.en
	);
	const secondary = $derived(locale === 'en' ? names.mr : names.en);
	const secondaryLang = locale === 'en' ? 'mr' : 'en';
</script>

<article
	class="relative overflow-hidden rounded-card border border-border bg-surface text-text"
	data-clip-check
>
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass resolve()d hrefs -->
	<a {href} class="block text-text no-underline">
		<div
			class="aspect-[4/3] w-full bg-sand-200 bg-cover bg-center dark:bg-raised"
			style:background-image={photo?.lqip ? `url(${photo.lqip})` : undefined}
		>
			{#if photo}
				<img
					src={photo.src}
					srcset={photo.srcset}
					sizes="(min-width: 1024px) 360px, 100vw"
					alt={photo.alt}
					loading="lazy"
					decoding="async"
					width="400"
					height="300"
					class="h-full w-full object-cover"
				/>
			{:else if fallbackCategory}
				<!-- No stock photos: show the category glyph until a verifier photo exists. -->
				<div class="flex h-full items-center justify-center text-text-2">
					<CategoryIcon category={fallbackCategory} size={40} />
				</div>
			{/if}
		</div>
		<div class="flex flex-col gap-2 p-4">
			<div>
				<h3 class="type-h2">{primary}</h3>
				{#if secondary && secondary !== primary}
					<p class="type-small text-text-2" lang={secondaryLang}>{secondary}</p>
				{/if}
			</div>
			{@render children?.()}
		</div>
	</a>
	{#if onsave}
		<button
			type="button"
			class="absolute top-2 right-2 flex size-11 items-center justify-center rounded-chip bg-raised/90 text-laterite-500 shadow-float dark:text-cta"
			aria-pressed={saved}
			aria-label={saved ? m.saved() : m.save()}
			onclick={onsave}
		>
			<Heart size={20} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
		</button>
	{/if}
</article>
