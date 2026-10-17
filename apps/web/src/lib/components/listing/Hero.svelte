<script lang="ts">
	import CategoryIcon, { type Category } from '../CategoryIcon.svelte';

	// 16:9 hero (FRONTEND §3). Verifier/owner photos only; without one, the category glyph (no stock photos).
	let {
		photo,
		category
	}: {
		photo: { src: string; srcset: string; lqip?: string; alt: string } | null;
		category?: Category;
	} = $props();
</script>

<div
	class="-mx-4 aspect-video overflow-hidden bg-sand-200 bg-cover bg-center sm:mx-0 sm:rounded-card dark:bg-raised"
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
	{:else if category}
		<div class="flex h-full items-center justify-center text-text-2">
			<CategoryIcon {category} size={56} />
		</div>
	{/if}
</div>
