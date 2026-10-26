<script lang="ts">
	import { stripGeometry, type StripLeg } from '#lib/nav/strip.ts';

	// Mini route strip above a day's timeline (Report 1 §4.4, Report 2 §9.8, T-32): the stored OSRM shapes (the
	// navigation data the plan page already caches), straight dashed guides where no shape is stored, numbered stops
	// in the map pin colours. No basemap: a line on the land colour, so it is light and works offline.
	let { legs, label }: { legs: (StripLeg & { to: { name: string } })[]; label: string } = $props();

	const W = 320;
	const H = 96;
	const g = $derived(stripGeometry(legs, W, H));
	const dot = (kind: string) =>
		kind === 'meal'
			? ['fill-alphonso', 'fill-on-alphonso']
			: kind === 'stay'
				? ['fill-lagoon', 'fill-on-lagoon']
				: ['fill-kokum', 'fill-on-kokum'];
</script>

{#if g && g.stops.length}
	<svg
		viewBox="0 0 {W} {H}"
		class="h-auto w-full rounded-lg bg-surface-2 print:hidden"
		role="img"
		aria-label="{label}: {legs.map((l) => l.to.name).join(' → ')}"
		data-testid="route-strip"
	>
		{#each g.paths as p, i (i)}
			{#if p.guide}
				<path
					d={p.d}
					class="fill-none stroke-muted"
					stroke-width="2"
					stroke-dasharray="4 4"
					stroke-linecap="round"
				/>
			{:else}
				<path
					d={p.d}
					class="fill-none stroke-surface"
					stroke-width="6"
					stroke-linejoin="round"
					stroke-linecap="round"
				/>
				<path
					d={p.d}
					class="fill-none stroke-lagoon"
					stroke-width="3"
					stroke-linejoin="round"
					stroke-linecap="round"
				/>
			{/if}
		{/each}
		{#if g.start}
			<circle
				cx={g.start[0]}
				cy={g.start[1]}
				r="5"
				class="fill-surface stroke-text"
				stroke-width="2"
			/>
		{/if}
		{#each g.stops as s, i (i)}
			{@const [fill, ink] = dot(s.kind)}
			<circle cx={s.at[0]} cy={s.at[1]} r="9" class={[fill, 'stroke-surface']} stroke-width="2" />
			<text
				x={s.at[0]}
				y={s.at[1]}
				dy="0.35em"
				text-anchor="middle"
				class={[ink, 'text-[10px] font-semibold']}>{i + 1}</text
			>
		{/each}
	</svg>
{/if}
