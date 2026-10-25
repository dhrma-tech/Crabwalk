<script lang="ts">
	import type { Category } from '../CategoryIcon.svelte';
	import NoPhoto, { type Kind } from '../NoPhoto.svelte';

	// 16:9 hero (FRONTEND §3). Own or CC-licensed photos only (T-7); without one, the designed no-photo card.
	let {
		photo,
		category,
		kind
	}: {
		photo: { src: string; srcset: string; lqip?: string; alt: string } | null;
		category?: Category;
		kind?: Kind;
	} = $props();
</script>

<div
	class="aspect-video overflow-hidden rounded-lg bg-surface-2 bg-cover bg-center"
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
	{:else}
		<NoPhoto {category} {kind} />
	{/if}
</div>
