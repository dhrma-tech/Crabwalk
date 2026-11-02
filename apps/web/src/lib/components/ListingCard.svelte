<script lang="ts" module>
	export type Photo = { src: string; srcset?: string; alt: string; lqip?: string };
	export type Names = { en: string; hi?: string | null; mr?: string | null };
</script>

<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { isSaved, loadSaved, toggleSaved, type SavedKind } from '#lib/saved.svelte.ts';
	import Heart from '@lucide/svelte/icons/heart';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import type { Category } from './CategoryIcon.svelte';
	import NoPhoto, { type Kind } from './NoPhoto.svelte';
	import IconButton from './IconButton.svelte';

	// Shared shell for Place/Stay/Eatery cards (Report 2 §8): a surface card, 4:3 photo (or the designed no-photo
	// card) with glass badges top-left (`overlay`) and the heart top-right, then name, other script and body.
	// Pointer hover zooms the photo and lifts the card. `row` = inset list row (InsetList) with a 96 px thumbnail
	// and a chevron (the heart takes the chevron's place when the row can be saved). `row="below-lg"` = a row on
	// phones and tablets, a card from lg up, in one element (lists render each listing once, not once per layout).
	let {
		href,
		photo,
		names,
		category,
		kind,
		row = false,
		level = 3,
		saved = false,
		onsave,
		item,
		overlay,
		children
	}: {
		href: string;
		photo?: Photo | null;
		names: Names;
		category?: Category;
		kind?: Kind;
		row?: boolean | 'below-lg';
		/** Heading level of the name: 2 when the cards sit right under the page title (lists). */
		level?: 2 | 3;
		saved?: boolean;
		onsave?: () => void;
		/** The listing behind the card: its heart then follows the visitor's saved list (T-46). */
		item?: { type: SavedKind; slug: string };
		overlay?: Snippet;
		children?: Snippet;
	} = $props();

	onMount(() => void (item && loadSaved()));
	const on = $derived(item ? isSaved(item.type, item.slug) : saved);
	const save = $derived(item ? () => toggleSaved(item.type, item.slug) : onsave);

	// Primary language on top, the other script below (§2.3).
	const locale = getLocale();
	const primary = $derived(
		(locale === 'hi' ? names.hi : locale === 'mr' ? names.mr : null) || names.en
	);
	const secondary = $derived(locale === 'en' ? names.mr : names.en);
	const secondaryLang = locale === 'en' ? 'mr' : 'en';
	// Literal class lists per layout (Tailwind only sees whole strings): max-lg: = row part, lg: = card part.
	const both = $derived(row === 'below-lg');
</script>

<article
	class={[
		'group relative text-text',
		!row &&
			'h-full rounded-lg bg-surface shadow-e1 transition-shadow duration-300 ease-brand hover:shadow-e2',
		both &&
			'lg:h-full lg:rounded-lg lg:bg-surface lg:shadow-e1 lg:transition-shadow lg:duration-300 lg:ease-brand lg:hover:shadow-e2'
	]}
	data-clip-check
>
	<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass resolve()d hrefs -->
	<a
		{href}
		class={[
			'text-text no-underline',
			both
				? 'flex max-lg:row-link max-lg:items-center max-lg:gap-3.5 max-lg:p-3 max-lg:focus-visible:-outline-offset-2 lg:h-full lg:flex-col lg:rounded-lg'
				: row
					? 'row-link flex items-center gap-3.5 p-3 focus-visible:-outline-offset-2'
					: 'flex h-full flex-col rounded-lg',
			row && save && (both ? 'max-lg:pr-16' : 'pr-16')
		]}
	>
		<div
			class={[
				'shrink-0 overflow-hidden bg-surface-2 bg-cover bg-center',
				both
					? 'max-lg:size-24 max-lg:rounded-md lg:aspect-[4/3] lg:w-full lg:rounded-t-lg'
					: row
						? 'size-24 rounded-md'
						: 'aspect-[4/3] w-full rounded-t-lg'
			]}
			style:background-image={photo?.lqip ? `url(${photo.lqip})` : undefined}
		>
			{#if photo}
				<img
					src={photo.src}
					srcset={photo.srcset}
					sizes={both
						? '(min-width: 1024px) 360px, 96px'
						: row
							? '96px'
							: '(min-width: 1024px) 360px, 100vw'}
					alt={photo.alt}
					loading="lazy"
					decoding="async"
					width="400"
					height="300"
					class="h-full w-full object-cover transition-transform duration-300 ease-brand group-hover:scale-[1.03]"
				/>
			{:else}
				<NoPhoto {category} {kind} label={both ? 'lg' : !row} />
			{/if}
		</div>
		<div class={['flex min-w-0 flex-1 flex-col gap-1.5', !row && 'p-3.5', both && 'lg:p-3.5']}>
			<div>
				<svelte:element this={`h${level}`} class="type-h3">{primary}</svelte:element>
				{#if secondary && secondary !== primary}
					<p class="type-small text-text-2" lang={secondaryLang}>{secondary}</p>
				{/if}
			</div>
			{@render children?.()}
		</div>
		{#if row && !save}<ChevronRight
				size={20}
				aria-hidden="true"
				class={both ? 'text-muted lg:hidden' : 'text-muted'}
			/>{/if}
	</a>
	{#if overlay && (!row || both)}
		<div
			class={[
				'pointer-events-none absolute top-3 left-3 flex flex-wrap gap-1.5 pr-14',
				both && 'max-lg:hidden'
			]}
		>
			{@render overlay()}
		</div>
	{/if}
	{#if save}
		<IconButton
			glass={both ? 'lg' : !row}
			label={on ? m.saved() : m.save()}
			aria-pressed={on}
			class={[
				'absolute right-2',
				both
					? 'max-lg:top-1/2 max-lg:-translate-y-1/2 lg:top-2'
					: row
						? 'top-1/2 -translate-y-1/2'
						: 'top-2'
			]}
			onclick={save}
		>
			<Heart
				size={20}
				fill={on ? 'currentColor' : 'none'}
				aria-hidden="true"
				class={on ? 'text-kokum' : undefined}
			/>
		</IconButton>
	{/if}
</article>
