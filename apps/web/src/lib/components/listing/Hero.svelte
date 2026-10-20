<script lang="ts">
	import { categoryTone, type Category } from '../CategoryIcon.svelte';
	import NoPhoto, { type Tone } from '../NoPhoto.svelte';

	// 16:9 hero (FRONTEND §3). Verifier/owner photos only; without one, the Suna no-photo pattern.
	let {
		photo,
		category,
		tone
	}: {
		photo: { src: string; srcset: string; lqip?: string; alt: string } | null;
		category?: Category;
		tone?: Tone;
	} = $props();
</script>

<div
	class="aspect-video overflow-hidden bg-border bg-cover bg-center"
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
		<NoPhoto tone={tone ?? (category ? categoryTone[category] : 'asagi')} />
	{/if}
</div>
