<script lang="ts" module>
	export type Photo = { src: string; srcset?: string; alt: string; lqip?: string };
	export type Names = { en: string; hi?: string | null; mr?: string | null };
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import Heart from '@lucide/svelte/icons/heart';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { categoryTone, type Category } from './CategoryIcon.svelte';
	import NoPhoto, { type Tone } from './NoPhoto.svelte';

	// Shared shell for Place/Stay/Eatery cards (FRONTEND §6.3): 4:3 photo (or the no-photo pattern), heart,
	// bilingual name, body. Suna: no box, just the image and the words under it; `row` = list row with a
	// 110×84 thumbnail (Stays / Food lists, design 4a/6a).
	let {
		href,
		photo,
		names,
		fallbackCategory,
		tone,
		row = false,
		level = 3,
		saved = false,
		onsave,
		children
	}: {
		href: string;
		photo?: Photo | null;
		names: Names;
		fallbackCategory?: Category;
		tone?: Tone;
		row?: boolean;
		/** Heading level of the name: 2 when the cards sit right under the page title (lists). */
		level?: 2 | 3;
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

<article class={['relative text-text', row && 'border-t border-border pt-3']} data-clip-check>
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass resolve()d hrefs -->
	<a {href} class={['group text-text no-underline', row ? 'flex gap-3.5' : 'block']}>
		<div
			class={[
				row ? 'h-[84px] w-[110px] shrink-0' : 'aspect-[4/3] w-full',
				'bg-border bg-cover bg-center'
			]}
			style:background-image={photo?.lqip ? `url(${photo.lqip})` : undefined}
		>
			{#if photo}
				<img
					src={photo.src}
					srcset={photo.srcset}
					sizes={row ? '110px' : '(min-width: 1024px) 360px, 100vw'}
					alt={photo.alt}
					loading="lazy"
					decoding="async"
					width="400"
					height="300"
					class="h-full w-full object-cover"
				/>
			{:else}
				<NoPhoto
					tone={tone ?? (fallbackCategory ? categoryTone[fallbackCategory] : 'asagi')}
					label={!row}
				/>
			{/if}
		</div>
		<div class={['flex min-w-0 flex-col gap-1.5', row ? 'pr-11' : 'pt-2']}>
			<div>
				<svelte:element
					this={`h${level}`}
					class="type-h3 decoration-1 underline-offset-4 group-hover:underline"
					>{primary}</svelte:element
				>
				{#if secondary && secondary !== primary}
					<p class="text-[13px] text-text-2" lang={secondaryLang}>{secondary}</p>
				{/if}
			</div>
			{@render children?.()}
		</div>
	</a>
	{#if onsave}
		<button
			type="button"
			class={[
				'absolute right-0 flex size-11 items-center justify-center bg-bg/70 text-text',
				row ? 'top-2' : 'top-0'
			]}
			aria-pressed={saved}
			aria-label={saved ? m.saved() : m.save()}
			onclick={onsave}
		>
			<Heart size={20} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
		</button>
	{/if}
</article>
