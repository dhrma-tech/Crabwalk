<script lang="ts">
	// Section edges (brief §7, "Section transitions"): no flat colour cuts. Drawn in the colour of the section it
	// belongs to, overlapping the neighbour. `wave` = shoreline, `torn` = torn paper, `tide` = a rippling tide line.
	let {
		kind = 'wave',
		color,
		at = 'top',
		height = 48,
		animate = false
	}: {
		kind?: 'wave' | 'torn' | 'tide' | 'scallop';
		color: string;
		at?: 'top' | 'bottom';
		height?: number;
		animate?: boolean;
	} = $props();

	// Paths in a 1440 × 60 box, filled below the edge line (flipped for `bottom`).
	const PATHS = {
		wave: 'M0 30 C 120 6, 240 6, 360 28 S 600 52, 720 30 S 960 6, 1080 28 S 1320 50, 1440 26 L1440 60 L0 60 Z',
		torn: 'M0 34 L38 28 L64 36 L102 22 L131 31 L170 26 L196 38 L240 24 L276 33 L312 20 L344 30 L380 27 L402 39 L446 25 L480 32 L522 21 L560 34 L590 26 L628 37 L664 23 L700 31 L736 25 L770 36 L812 22 L846 30 L880 26 L908 38 L950 24 L986 33 L1020 21 L1058 32 L1094 27 L1122 37 L1164 23 L1198 31 L1236 25 L1268 36 L1306 22 L1340 30 L1380 26 L1410 35 L1440 27 L1440 60 L0 60 Z',
		tide: 'M0 32 Q 30 22 60 32 T 120 32 T 180 32 T 240 32 T 300 32 T 360 32 T 420 32 T 480 32 T 540 32 T 600 32 T 660 32 T 720 32 T 780 32 T 840 32 T 900 32 T 960 32 T 1020 32 T 1080 32 T 1140 32 T 1200 32 T 1260 32 T 1320 32 T 1380 32 T 1440 32 T 1500 32 T 1560 32 L1560 60 L0 60 Z',
		scallop: 'M0 40 a30 30 0 0 1 60 0 a30 30 0 0 1 60 0 a30 30 0 0 1 60 0 a30 30 0 0 1 60 0 a30 30 0 0 1 60 0 a30 30 0 0 1 60 0 a30 30 0 0 1 60 0 a30 30 0 0 1 60 0 a30 30 0 0 1 60 0 a30 30 0 0 1 60 0 a30 30 0 0 1 60 0 a30 30 0 0 1 60 0 a30 30 0 0 1 60 0 a30 30 0 0 1 60 0 a30 30 0 0 1 60 0 a30 30 0 0 1 60 0 a30 30 0 0 1 60 0 a30 30 0 0 1 60 0 a30 30 0 0 1 60 0 a30 30 0 0 1 60 0 a30 30 0 0 1 60 0 a30 30 0 0 1 60 0 a30 30 0 0 1 60 0 a30 30 0 0 1 60 0 L1440 60 L0 60 Z'
	};
</script>

<svg
	class={['edge', at, animate && kind === 'tide' && 'ripple']}
	viewBox="0 0 1440 60"
	preserveAspectRatio="none"
	style:height="{height}px"
	aria-hidden="true"
>
	<path d={PATHS[kind]} fill={color} />
	{#if kind === 'tide'}
		<path
			d={PATHS.tide.replace(' L1560 60 L0 60 Z', '')}
			fill="none"
			stroke="var(--sky)"
			stroke-width="2"
			opacity=".6"
			vector-effect="non-scaling-stroke"
		/>
	{/if}
</svg>

<style>
	.edge {
		position: absolute;
		left: 0;
		width: 100%;
		display: block;
		pointer-events: none;
		z-index: 3;
	}
	.top {
		bottom: calc(100% - 1px);
	}
	.bottom {
		top: calc(100% - 1px);
		transform: scaleY(-1);
	}
	@media (prefers-reduced-motion: no-preference) {
		.ripple path {
			animation: ripple 6s linear infinite;
		}
	}
	@keyframes ripple {
		to {
			transform: translateX(-120px);
		}
	}
</style>
