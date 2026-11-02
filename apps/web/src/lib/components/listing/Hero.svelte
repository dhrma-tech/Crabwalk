<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { licenceUrl, type Credit } from '#lib/photoCredit.ts';
	import type { Category } from '../CategoryIcon.svelte';
	import NoPhoto, { type Kind } from '../NoPhoto.svelte';

	// 16:9 hero (FRONTEND §3). Own or CC-licensed photos only (T-7); without one, the designed no-photo card.
	// `immersive` (detail pages, Report 2 §9.2): phones get a full-bleed 4:5 photo under the transparent top bar
	// (Page `overlay`); laptops a 16:9 card with --r-xl corners. A licensed photo shows its credit (author → source,
	// licence → its deed; T-51) in a glass pill on the photo, above the content sheet that overlaps it on phones.
	let {
		photo,
		category,
		kind,
		immersive = false
	}: {
		photo: { src: string; srcset: string; lqip?: string; alt: string; credit?: Credit } | null;
		category?: Category;
		kind?: Kind;
		immersive?: boolean;
	} = $props();
</script>

<div
	class={[
		'relative overflow-hidden bg-surface-2 bg-cover bg-center',
		immersive
			? '-mx-5 -mt-[calc(var(--bar-h)+env(safe-area-inset-top)+--spacing(2))] aspect-4/5 lg:mx-0 lg:mt-0 lg:rounded-xl'
			: 'aspect-video rounded-lg',
		// No photo on a laptop: a 3:1 band rather than a 16:9 wall of tint.
		immersive && (photo ? 'lg:aspect-video' : 'lg:aspect-3/1')
	]}
	style:background-image={photo?.lqip ? `url(${photo.lqip})` : undefined}
>
	{#if photo}
		<img
			src={photo.src}
			srcset={photo.srcset}
			sizes="(min-width: 1200px) 1200px, 100vw"
			alt={photo.alt}
			fetchpriority="high"
			decoding="async"
			class="h-full w-full object-cover"
		/>
		{#if photo.credit}
			{@const c = photo.credit}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- external source + licence links -->
			<p
				class={[
					'glass absolute left-3 max-w-[calc(100%-1.5rem)] rounded-full px-3 py-1 type-label text-text',
					immersive ? 'bottom-10 lg:bottom-3' : 'bottom-3'
				]}
				data-testid="photo-credit"
			>
				{m.photo_by()}
				<a href={c.source} target="_blank" rel="noopener" class="text-text">{c.name}</a> ·
				<a href={licenceUrl(c.licence)} target="_blank" rel="noopener license" class="text-text"
					>{c.licence}</a
				>
			</p>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/if}
	{:else}
		<!-- The content sheet overlaps an immersive hero by 28 px on phones: keep the label above it. -->
		<div class={['h-full', immersive && 'pb-7 lg:pb-0']}><NoPhoto {category} {kind} /></div>
	{/if}
</div>
