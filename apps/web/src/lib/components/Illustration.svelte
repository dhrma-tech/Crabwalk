<script lang="ts">
	// Empty/error vignettes (Report 2 §6): flat line-and-fill, brand colours only (tokens, so both themes work),
	// decorative. fort = 404, boat = offline, crab = empty search / nothing yet. Each well under 3 KB.
	let { name }: { name: 'fort' | 'boat' | 'crab' } = $props();
</script>

<svg viewBox="0 0 160 100" width="160" height="100" aria-hidden="true" class="h-auto w-40">
	{#if name === 'fort'}
		<circle cx="126" cy="24" r="10" fill="var(--alphonso)" />
		<path d="M24 74q14-16 34-14h44q22 0 34 14z" fill="var(--laterite-50)" />
		<path
			d="M44 62V38h8v-6h8v6h8v-6h8v6h8v-6h8v6h8v24z"
			fill="var(--laterite)"
			stroke="var(--laterite)"
			stroke-linejoin="round"
		/>
		<path d="M70 38V24h16v14" fill="var(--laterite)" />
		<path d="M78 24V10" stroke="var(--text-2)" stroke-width="1.5" stroke-linecap="round" />
		<path d="M78 10h12l-3 4 3 4H78z" fill="var(--kokum)" />
		<path d="M72 62v-9a6 6 0 0 1 12 0v9z" fill="var(--laterite-50)" />
		<rect x="0" y="72" width="160" height="28" fill="var(--lagoon-50)" />
		<path
			d="M8 82q8-5 16 0t16 0M64 90q8-5 16 0t16 0M112 80q8-5 16 0t16 0"
			fill="none"
			stroke="var(--lagoon)"
			stroke-width="1.5"
			stroke-linecap="round"
		/>
	{:else if name === 'boat'}
		<circle cx="34" cy="30" r="9" fill="var(--alphonso)" />
		<rect x="0" y="70" width="160" height="30" fill="var(--lagoon-50)" />
		<path d="M84 18v44" stroke="var(--text-2)" stroke-width="1.5" stroke-linecap="round" />
		<path d="M84 18h14l-4 4 4 4H84z" fill="var(--lagoon)" />
		<path d="M90 46h18v14H90z" fill="var(--surface)" stroke="var(--text-2)" stroke-width="1.5" />
		<path
			d="M46 60h82l-12 14H58z"
			fill="var(--kokum)"
			stroke="var(--kokum)"
			stroke-linejoin="round"
		/>
		<path d="M54 64h66" stroke="var(--alphonso)" stroke-width="2" />
		<path
			d="M20 84q8-4 16 0t16 0M92 88q8-4 16 0t16 0M60 80h20M120 78h14"
			fill="none"
			stroke="var(--lagoon)"
			stroke-width="1.5"
			stroke-linecap="round"
		/>
	{:else}
		<path d="M8 80q20-16 40-10t40-4 64 14v20H8z" fill="var(--alphonso-50)" />
		<path
			d="M8 80q20-16 40-10t40-4 64 14"
			fill="none"
			stroke="var(--alphonso)"
			stroke-width="1.5"
		/>
		<path d="M72 70q8-12 16 0z" fill="var(--kokum)" />
		<path
			d="M76 66l-3-12M84 66l3-12M66 70l-8-10M94 70l8-10"
			stroke="var(--kokum)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		<path d="M58 60l-2.6-4.9A5.5 5.5 0 1 0 60.6 55z" fill="var(--kokum)" />
		<path d="M102 60l2.6-4.9A5.5 5.5 0 1 1 99.4 55z" fill="var(--kokum)" />
		<circle cx="73" cy="52" r="4" fill="#fff" stroke="var(--kokum)" stroke-width="1.5" />
		<circle cx="87" cy="52" r="4" fill="#fff" stroke="var(--kokum)" stroke-width="1.5" />
		<circle cx="73.6" cy="52.4" r="1.7" fill="var(--kokum)" />
		<circle cx="86.4" cy="52.4" r="1.7" fill="var(--kokum)" />
		<path d="M28 84a5 5 0 0 1 10 0z" fill="var(--laterite)" />
		<path d="M122 88q4-6 8 0q-4 3-8 0z" fill="var(--lagoon)" />
	{/if}
</svg>
