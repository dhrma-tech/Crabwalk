<script lang="ts" module>
	import type { Category } from './CategoryIcon.svelte';

	export type Kind = 'stay' | 'eatery' | 'dish';
	type Scene = 'coast' | 'heritage' | 'land';
	// Brief section 4.9: coast = beach, backwater, stays; heritage = fort, temple, museum (cave), dishes;
	// land = waterfall, viewpoint, village, orchard, market, eateries.
	const sceneOf: Record<Category | Kind, Scene> = {
		beach: 'coast',
		backwater: 'coast',
		stay: 'coast',
		fort: 'heritage',
		temple: 'heritage',
		museum: 'heritage',
		cave: 'heritage',
		dish: 'heritage',
		waterfall: 'land',
		viewpoint: 'land',
		village: 'land',
		orchard: 'land',
		market: 'land',
		eatery: 'land'
	};
</script>

<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';

	// No stock photos (CLAUDE.md §2). A designed card, not a placeholder (Report 2 §6): a flat scene for the
	// listing's family in token colours (both themes; T1-07, brief section 4.9) and "Photo coming soon". The scene
	// is cropped from the bottom centre, so the ground stays in every shape (4:3 card, 96 px square, 3:1 band).
	let {
		category,
		kind,
		label = true
		/** `'lg'`: the label shows from lg up only (a ListingCard that is a row below lg). */
	}: { category?: Category; kind?: Kind; label?: boolean | 'lg' } = $props();

	const scene = $derived(sceneOf[kind ?? category ?? 'beach']);
</script>

<div class="relative flex h-full w-full items-end p-3">
	<svg
		viewBox="0 0 160 100"
		preserveAspectRatio="xMidYMax slice"
		class="absolute inset-0 h-full w-full"
		aria-hidden="true"
		fill="none"
		stroke-width="1.5"
		stroke-linecap="round"
	>
		{#if scene === 'coast'}
			<rect width="160" height="100" fill="var(--lagoon-50)" />
			<circle cx="58" cy="30" r="8" fill="var(--alphonso)" />
			<path
				d="M0 52h160M14 64q8-4 16 0t16 0M66 74q8-4 16 0t16 0M24 86q8-4 16 0t16 0"
				stroke="var(--lagoon)"
			/>
			<path d="M110 100q-4-30 10-56" stroke="var(--laterite)" stroke-width="3" />
			<path
				d="M120 44q-14-6-24 4M120 44q-4-12-16-14M120 44q8-10 20-8M120 44q12 2 16 12M120 44q-4 6-8 14"
				stroke="var(--ok)"
				stroke-width="3"
			/>
		{:else if scene === 'heritage'}
			<rect width="160" height="100" fill="var(--laterite-50)" />
			<circle cx="36" cy="28" r="8" fill="var(--alphonso)" />
			{#if category === 'temple'}
				<path d="M88 62V48q0-6 4-10l8-18q2-4 4 0l8 18q4 4 4 10v14z" fill="var(--laterite)" />
				<path d="M102 16V8l7 3-7 3" stroke="var(--kokum)" />
			{:else}
				<path d="M84 62V38h6v-6h6v6h6v-6h6v6h6v-6h6v6h4v24z" fill="var(--laterite)" />
			{/if}
			<path
				d="M0 62h160M0 74h160M0 86h160M20 62v12M60 62v12M104 62v12M140 62v12M40 74v12M84 74v12M124 74v12M16 86v14M66 86v14M112 86v14"
				stroke="var(--laterite)"
			/>
		{:else}
			<rect width="160" height="100" fill="var(--ok-50)" />
			<path d="M0 80q40-14 80-4t80-6v30H0z" fill="var(--ok)" opacity=".15" />
			<path d="M0 64q30-18 60-6t50-10 50 6M0 80q40-14 80-4t80-6" stroke="var(--ok)" />
			<path d="M160 16q-30 4-46 24" stroke="var(--laterite)" stroke-width="2.5" />
			<path d="M134 22q-6-10 6-14q2 10-6 14zM122 30q-12-2-8-12q8 4 8 12z" fill="var(--ok)" />
			<path d="M112 42q-6 4-4 12q4 8 12 4q6-4 2-12q-4-6-10-4z" fill="var(--caution)" />
		{/if}
	</svg>
	{#if label}<span
			class={[
				'relative rounded-md bg-surface/85 px-2 py-0.5 type-small text-text-2',
				label === 'lg' && 'max-lg:hidden'
			]}>{m.photo_soon()}</span
		>{/if}
</div>
