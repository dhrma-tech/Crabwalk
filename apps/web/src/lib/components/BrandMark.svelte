<script lang="ts">
	// Wordmark placeholder (Report 2 §6; the logo is [OPEN], artist pending): a sideways double chevron ‹› (a crab's
	// sidestep) and `crabwalk` in lowercase Eczar 700, kokum. Decorative: the link around it carries the name.
	let { size = 24, wordmark = false }: { size?: number; wordmark?: boolean } = $props();
</script>

<span class="flex shrink-0 items-center gap-1.5 text-kokum" aria-hidden="true">
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor">
		<path
			d="M9.5 6 3.5 12l6 6M14.5 6l6 6-6 6"
			stroke-width="2.75"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
	{#if wordmark}<span class="type-h1 leading-none" lang="en">crabwalk</span>{/if}
</span>
