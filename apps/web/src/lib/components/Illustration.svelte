<script lang="ts" module>
	export type Art = 'fort' | 'boat' | 'crab' | 'net' | 'tide' | 'lamp' | 'compass' | 'crate';
</script>

<script lang="ts">
	// Empty/error vignettes (Report 2 §6): flat line-and-fill, brand colours only (tokens, so both themes work),
	// decorative. fort = 404, boat = offline, crab = empty search / nothing yet. Each well under 3 KB.
	// Hardening T1-07 (brief section 4.9): net = no results for filters, tide = rate limit, lamp = Crabby
	// unavailable, compass = location denied, crate = pack download (`progress` 0–1 fills it with mangoes).
	let {
		name,
		progress = 0,
		class: cls = 'w-40'
	}: { name: Art; progress?: number; class?: string } = $props();
	const uid = $props.id();
	const p = $derived(Math.min(1, Math.max(0, progress)));
</script>

<svg viewBox="0 0 160 100" width="160" height="100" aria-hidden="true" class={['h-auto', cls]}>
	{#if name === 'net'}
		<circle cx="130" cy="20" r="9" fill="var(--alphonso)" />
		<path d="M0 74q40-8 80-2t80 0v28H0z" fill="var(--alphonso-50)" />
		<clipPath id="{uid}n"><path d="M40 26h80q-40 44-80 0z" /></clipPath>
		<path
			clip-path="url(#{uid}n)"
			d="M24 26l48 48M40 26l48 48M56 26l48 48M72 26l48 48M88 26l48 48M136 26l-48 48M120 26l-48 48M104 26l-48 48M88 26l-48 48M72 26l-48 48"
			stroke="var(--lagoon)"
			fill="none"
		/>
		<path d="M40 26q40 44 80 0" fill="none" stroke="var(--lagoon)" stroke-width="1.5" />
		<path d="M36 26h88" stroke="var(--text-2)" stroke-width="1.5" />
		<path
			d="M40 78V18M120 78V18"
			stroke="var(--laterite)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		<circle cx="60" cy="26" r="3" fill="var(--kokum)" />
		<circle cx="80" cy="26" r="3" fill="var(--kokum)" />
		<circle cx="100" cy="26" r="3" fill="var(--kokum)" />
		<path d="M18 88a5 5 0 0 1 10 0z" fill="var(--laterite)" />
	{:else if name === 'tide'}
		<circle cx="32" cy="24" r="9" fill="var(--alphonso)" />
		<rect
			x="75"
			y="12"
			width="10"
			height="84"
			rx="2"
			fill="var(--surface)"
			stroke="var(--text-2)"
			stroke-width="1.5"
		/>
		<rect x="75" y="12" width="10" height="8" rx="2" fill="var(--kokum)" />
		<path
			d="M75 28h5M75 38h5M75 48h5M75 58h5M75 68h5M75 78h5"
			stroke="var(--text-2)"
			stroke-width="1.5"
		/>
		<path d="M0 36q10-4 20 0t20 0 20 0 20 0 20 0 20 0 20 0 20 0v64H0z" fill="var(--lagoon-50)" />
		<path
			d="M0 36q10-4 20 0t20 0 20 0 20 0 20 0 20 0 20 0 20 0M18 60q8-4 16 0M112 72q8-4 16 0M50 84q8-4 16 0"
			fill="none"
			stroke="var(--lagoon)"
			stroke-width="1.5"
			stroke-linecap="round"
		/>
	{:else if name === 'lamp'}
		<path
			d="M126 12a11 11 0 1 0 10 17 9 9 0 1 1-10-17z"
			fill="var(--alphonso-50)"
			stroke="var(--alphonso)"
			stroke-width="1.5"
		/>
		<path d="M40 84q14-14 32-12h18q22 0 30 12z" fill="var(--laterite-50)" />
		<path
			d="M70 76l4-46h16l4 46z"
			fill="var(--surface)"
			stroke="var(--text-2)"
			stroke-width="1.5"
			stroke-linejoin="round"
		/>
		<path d="M72.6 44h18.8l.9 10H71.7zM71.1 62h21.8l.7 9H70.4z" fill="var(--kokum)" />
		<rect
			x="72"
			y="18"
			width="20"
			height="12"
			rx="2"
			fill="var(--surface-3)"
			stroke="var(--text-2)"
			stroke-width="1.5"
		/>
		<path d="M70 18l12-8 12 8z" fill="var(--kokum)" />
		<path d="M66 30h32" stroke="var(--text-2)" stroke-width="1.5" stroke-linecap="round" />
		<rect y="80" width="160" height="20" fill="var(--lagoon-50)" />
		<path
			d="M10 88q8-4 16 0t16 0M110 90q8-4 16 0t16 0"
			fill="none"
			stroke="var(--lagoon)"
			stroke-width="1.5"
			stroke-linecap="round"
		/>
	{:else if name === 'compass'}
		<path d="M0 66q40-10 80-4t80 2v36H0z" fill="var(--alphonso-50)" />
		<ellipse cx="84" cy="84" rx="30" ry="5" fill="var(--alphonso)" opacity=".35" />
		<circle cx="80" cy="25" r="3.5" fill="none" stroke="var(--text-2)" stroke-width="1.5" />
		<circle
			cx="80"
			cy="56"
			r="27"
			fill="var(--surface)"
			stroke="var(--text-2)"
			stroke-width="1.5"
		/>
		<circle cx="80" cy="56" r="21" fill="none" stroke="var(--text-2)" stroke-dasharray="2 4.6" />
		<path d="M80 37l5 19h-10z" fill="var(--kokum)" />
		<path d="M80 75l-5-19h10z" fill="var(--lagoon)" />
		<circle cx="80" cy="56" r="2.5" fill="var(--text)" />
		<path d="M24 88a5 5 0 0 1 10 0z" fill="var(--laterite)" />
		<path d="M130 86q4-6 8 0q-4 3-8 0z" fill="var(--lagoon)" />
	{:else if name === 'crate'}
		<rect y="84" width="160" height="16" fill="var(--alphonso-50)" />
		<rect x="44" y="34" width="72" height="50" rx="3" fill="var(--laterite-50)" />
		<clipPath id="{uid}c"><rect x="44" y={84 - 50 * p} width="72" height={50 * p} /></clipPath>
		<g clip-path="url(#{uid}c)" fill="var(--alphonso)" stroke="var(--caution)">
			{#each [78, 68, 58, 48, 38] as y, r (y)}
				{#each [0, 1, 2, 3, 4] as c (c)}
					<ellipse cx={52 + c * 14 + (r % 2) * 4} cy={y} rx="6.5" ry="5" />
				{/each}
			{/each}
		</g>
		<path
			d="M44 46h72M44 62h72M44 78h72M47 34v50M113 34v50"
			stroke="var(--laterite)"
			stroke-width="3"
		/>
		<rect
			x="44"
			y="34"
			width="72"
			height="50"
			rx="3"
			fill="none"
			stroke="var(--laterite)"
			stroke-width="1.5"
		/>
		<path d="M122 84q6-14 18-16q-4 12-18 16z" fill="var(--ok)" />
	{:else if name === 'fort'}
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
