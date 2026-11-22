<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { reducedMotion } from '#lib/motion.ts';
	import { inview } from '../inview.ts';
	import { tr } from '../i18n.ts';
	import { MAP } from '../content/landing.ts';
	import { TALUKAS, MAP_PLACES, DISTRICT, type TalukaKey } from '../content/talukas.ts';
	import { TALUKA_GEO, project } from '../content/talukaGeo.ts';
	import Stamp from './Stamp.svelte';

	// "Discover Ratnagiri" (brief §7.2): real OSM boundaries. On entering: outline draws, then the taluka borders,
	// markers drop with an ink splash, leader lines run out and the labels type in. Hover (map or button) floods
	// a taluka with a watercolour wash and cross-fades the card; picking stamps that taluka's postage stamp on it.
	let selected = $state<TalukaKey>(DISTRICT.defaultTaluka);
	let hovered = $state<TalukaKey | null>(null);
	const shown = $derived(hovered ?? selected);
	const tal = $derived(TALUKAS.find((t) => t.key === shown)!);
	const idx = $derived(TALUKAS.findIndex((t) => t.key === shown) + 1);
	let started = $state(false);
	let typed = $state(99);

	const W = TALUKA_GEO.width;
	const LEFT = -24;
	const RIGHT = W + 10;
	const LABEL_DY: Record<string, number> = { 'Unhale springs': -16, 'Dhoot-Papeshwar': 16 };
	// Taluka names sit at their centroid, nudged where a marker lands on it.
	const NAME_D: Partial<Record<TalukaKey, [number, number]>> = {
		rajapur: [-20, -64],
		sangameshwar: [-14, -40],
		ratnagiri: [30, -150]
	};
	const places = MAP_PLACES.map((p, i) => {
		const [x, y] = project(p.lon, p.lat);
		const ly = y + (LABEL_DY[p.name.en] ?? 0);
		return { ...p, x, y, ly, i, tx: p.side === 'w' ? LEFT : RIGHT };
	});

	function enter() {
		started = true;
		if (reducedMotion.current) return;
		// Labels type in after the markers have dropped (~2.2 s).
		typed = 0;
		const t0 = performance.now() + 2300;
		const step = (now: number) => {
			typed = Math.max(0, Math.floor((now - t0) / 45));
			if (typed < 20) requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	}
	onMount(() => {
		if (reducedMotion.current) started = true;
	});
</script>

<section class="talukas" id="talukas" aria-labelledby="talukas-title">
	<div class="j-wrap grid">
		<div class="copy">
			<span class="rule" aria-hidden="true"></span>
			<h2 id="talukas-title" class="j-h2">{tr(MAP.title)}</h2>
			<p class="j-lead body">{tr(MAP.body)}</p>

			<div class="picker" role="group" aria-label={tr(MAP.pick)}>
				{#each TALUKAS as t (t.key)}
					<button
						class="j-chip"
						aria-pressed={t.key === selected}
						onclick={() => (selected = t.key)}
						onpointerenter={() => (hovered = t.key)}
						onpointerleave={() => (hovered = null)}
						onfocus={() => (hovered = t.key)}
						onblur={() => (hovered = null)}>{tr(t.name)}</button
					>
				{/each}
			</div>

			<article class="card" aria-live="polite">
				{#key shown}
					<div class="card-in">
						<div class="head">
							<h3>{tr(tal.name)}</h3>
							<span class="j-deva mr" lang="mr">{tal.name.mr}</span>
						</div>
						<p class="desc">{tr(tal.desc)}</p>
						<ul class="spots">
							{#each tal.spots as s, i (i)}<li>{tr(s)}</li>{/each}
						</ul>
						<a href={resolve('/discover')} class="explore"
							>{tr(MAP.explore).replace('{name}', tr(tal.name))}
							<span aria-hidden="true">→</span></a
						>
					</div>
					<div class="stamp-slot">
						<Stamp
							icon={tal.stamp}
							name={tal.name.en}
							deva={tal.name.mr}
							no={idx}
							caption={tr(MAP.stamp)}
						/>
					</div>
				{/key}
			</article>
		</div>

		<div
			class="map j-lazy"
			style:--j-lazy-h="760px"
			use:inview={{ onenter: enter, margin: '0px 0px -25% 0px' }}
		>
			<svg
				viewBox="-200 -20 1000 {TALUKA_GEO.height + 40}"
				role="img"
				aria-label={tr(MAP.aria).replace('{name}', tr(tal.name))}
				class={[started && 'go']}
			>
				<defs>
					<pattern id="sea-dots" width="9" height="9" patternUnits="userSpaceOnUse">
						<circle cx="2.5" cy="2.5" r="1.5" fill="#8aa7b9" />
						<circle cx="7" cy="7" r="1.5" fill="#8aa7b9" />
					</pattern>
					<linearGradient id="sea-fade" x1="0" x2="0" y1="0" y2="1">
						<stop offset="0" stop-color="#fff" stop-opacity="0" />
						<stop offset=".12" stop-color="#fff" />
						<stop offset=".9" stop-color="#fff" />
						<stop offset="1" stop-color="#fff" stop-opacity="0" />
					</linearGradient>
					<mask id="sea-mask" maskUnits="userSpaceOnUse">
						<rect
							x="-200"
							y="-20"
							width="1000"
							height={TALUKA_GEO.height + 40}
							fill="url(#sea-fade)"
						/>
					</mask>
					<!-- watercolour: ragged edges (displacement) + uneven pigment (noise in alpha) -->
					<filter id="wash" x="-10%" y="-10%" width="120%" height="120%">
						<feTurbulence
							type="fractalNoise"
							baseFrequency="0.035"
							numOctaves="3"
							seed="4"
							result="n"
						/>
						<feDisplacementMap
							in="SourceGraphic"
							in2="n"
							scale="14"
							xChannelSelector="R"
							yChannelSelector="G"
							result="d"
						/>
						<feTurbulence
							type="fractalNoise"
							baseFrequency="0.9"
							numOctaves="2"
							seed="9"
							result="g"
						/>
						<feColorMatrix
							in="g"
							type="matrix"
							values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 1.25"
							result="ga"
						/>
						<feComposite in="d" in2="ga" operator="in" result="p" />
						<feGaussianBlur in="p" stdDeviation="0.6" />
					</filter>
				</defs>

				<g mask="url(#sea-mask)">
					<path d={TALUKA_GEO.sea} fill="url(#sea-dots)" opacity=".8" />
				</g>
				<text x="120" y="1150" transform="rotate(-76 120 1150)" class="sea-label"
					>{tr(MAP.sea).toLocaleUpperCase('en-IN')}</text
				>

				<!-- talukas: paper fill, hover/selected wash on top -->
				<!-- each boundary once; the paper fill and the wash both reuse it -->
				<defs>
					{#each TALUKAS as t (t.key)}<path
							id="tk-{t.key}"
							d={TALUKA_GEO.talukas[t.key].d}
						/>{/each}
				</defs>
				<g class="fills">
					{#each TALUKAS as t (t.key)}
						<use
							href="#tk-{t.key}"
							class="fill"
							onpointerenter={() => (hovered = t.key)}
							onpointerleave={() => (hovered = null)}
							onclick={() => (selected = t.key)}
							role="presentation"
						/>
					{/each}
				</g>
				<g class="washes" aria-hidden="true">
					{#each TALUKAS as t (t.key)}
						<use
							href="#tk-{t.key}"
							class={['wash', t.key === shown && 'on', t.key === selected && 'sel']}
							filter="url(#wash)"
						/>
					{/each}
				</g>
				<path d={TALUKA_GEO.borders} class="borders" pathLength="1" />
				<path d={TALUKA_GEO.outline} class="district" pathLength="1" />

				<!-- taluka names -->
				<g class="names">
					{#each TALUKAS as t (t.key)}
						{@const g = TALUKA_GEO.talukas[t.key]}
						<text
							x={g.cx + (NAME_D[t.key]?.[0] ?? 0)}
							y={g.cy + (NAME_D[t.key]?.[1] ?? 0)}
							class={[t.key === shown && 'on']}>{tr(t.name)}</text
						>
					{/each}
				</g>

				<!-- places: leader lines, markers with an ink splash, labels that type in -->
				<g class="places">
					{#each places as p (p.i)}
						<g style:--i={p.i}>
							<path
								d="M{p.x} {p.y} L{p.side === 'w' ? p.tx + 8 : p.tx - 8} {p.ly} L{p.tx} {p.ly}"
								class="leader"
								pathLength="1"
							/>
							<circle
								cx={p.x}
								cy={p.y}
								r="12"
								class="splash"
								style:transform-origin="{p.x}px {p.y}px"
							/>
							<g class="marker" style:transform-origin="{p.x}px {p.y}px">
								<circle
									cx={p.x}
									cy={p.y}
									r={p.main ? 8 : 6}
									fill="#f5efeb"
									stroke="#2f4156"
									stroke-width="1.8"
								/>
								<circle cx={p.x} cy={p.y} r={p.main ? 3.4 : 2.2} fill="#2f4156" />
							</g>
							<text
								x={p.side === 'w' ? p.tx - 6 : p.tx + 6}
								y={p.ly + 4.5}
								text-anchor={p.side === 'w' ? 'end' : 'start'}
								class={['label', p.main && 'main']}>{tr(p.name).slice(0, typed)}</text
							>
						</g>
					{/each}
				</g>

				<!-- north arrow -->
				<g transform="translate(700 50)" class="north">
					<circle r="26" />
					<path d="M0 -17 L8.5 9 L0 3.4 L-8.5 9 Z" />
					<text y="-36" text-anchor="middle">{MAP.north}</text>
				</g>
			</svg>
			<p class="credit">{tr(MAP.source)}</p>
		</div>
	</div>
</section>

<style>
	.talukas {
		position: relative;
		z-index: 1;
		background: var(--beige);
		padding: 120px 0 104px;
	}
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 440px) minmax(0, 1fr);
		gap: 48px;
		align-items: center;
	}
	.rule {
		display: block;
		width: 32px;
		height: 3px;
		border-radius: 2px;
		background: var(--laterite);
	}
	h2 {
		margin-top: 16px;
		color: var(--muted);
	}
	.body {
		margin-top: 18px;
	}
	.picker {
		margin-top: 28px;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.card {
		position: relative;
		display: grid;
		margin-top: 24px;
		padding: 24px;
		padding-right: 132px;
		min-height: 236px;
		background: var(--white);
		border: 1.5px solid var(--navy);
		border-radius: 24px;
		box-shadow: 5px 5px 0 var(--navy);
	}
	.card-in {
		grid-area: 1 / 1;
	}
	.stamp-slot {
		position: absolute;
		top: 18px;
		right: 14px;
	}
	.head {
		display: flex;
		align-items: baseline;
		gap: 12px;
		flex-wrap: wrap;
	}
	h3 {
		font-family: var(--j-display);
		font-weight: 400;
		font-size: 32px;
		line-height: 1.1;
	}
	.mr {
		font-size: 20px;
		color: var(--muted);
	}
	.desc {
		margin-top: 8px;
		color: var(--muted);
		font-size: 15px;
	}
	.spots {
		margin-top: 14px;
		padding: 0;
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.spots li {
		padding: 5px 12px;
		border-radius: 999px;
		background: var(--beige);
		border: 1px dashed var(--haze);
		font-size: 13px;
		font-weight: 600;
	}
	.explore {
		display: inline-flex;
		gap: 6px;
		margin-top: 16px;
		font-weight: 600;
		text-underline-offset: 4px;
	}
	.map {
		min-width: 0;
		display: grid;
		justify-items: center;
	}
	.map svg {
		width: 100%;
		max-width: 640px;
		height: auto;
		max-height: 88vh;
		overflow: visible;
	}
	.credit {
		margin-top: 6px;
		font-size: 11px;
		color: var(--muted);
	}
	.sea-label {
		font: 600 18px var(--j-text);
		letter-spacing: 9px;
		fill: var(--teal);
	}
	.fill {
		fill: #fffdfb;
		cursor: pointer;
	}
	.wash {
		fill: var(--mist);
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.45s var(--j-ease);
	}
	.wash.sel {
		opacity: 0.55;
	}
	.wash.on {
		opacity: 1;
		fill: #9fbfd3;
	}
	.borders {
		fill: none;
		stroke: var(--haze);
		stroke-width: 1.4;
		stroke-linejoin: round;
	}
	.district {
		fill: none;
		stroke: var(--navy);
		stroke-width: 2.4;
		stroke-linejoin: round;
	}
	.names text {
		font-family: var(--j-display);
		font-size: 30px;
		text-anchor: middle;
		fill: var(--teal);
		pointer-events: none;
		transition: fill 0.3s;
	}
	.names text.on {
		fill: var(--navy);
	}
	.leader {
		fill: none;
		stroke: var(--muted);
		stroke-width: 1;
	}
	.splash {
		fill: none;
		stroke: var(--laterite);
		stroke-width: 1.6;
		opacity: 0;
	}
	.label {
		font: 22px var(--j-text);
		fill: var(--navy);
	}
	.label.main {
		font-weight: 600;
	}
	.north circle {
		fill: none;
		stroke: var(--muted);
		stroke-width: 1.4;
	}
	.north path {
		fill: var(--muted);
	}
	.north text {
		font: 600 18px var(--j-text);
		fill: var(--muted);
	}

	@media (prefers-reduced-motion: no-preference) {
		svg:not(.go) :is(.district, .borders, .leader) {
			stroke-dasharray: 1;
			stroke-dashoffset: 1;
		}
		svg:not(.go) :is(.marker, .names, .fills, .sea-label) {
			opacity: 0;
		}
		.go .district {
			stroke-dasharray: 1;
			animation: draw 1.6s cubic-bezier(0.6, 0, 0.3, 1) both;
		}
		.go .fills {
			animation: fade 0.8s ease-out 0.6s both;
		}
		.go .borders {
			stroke-dasharray: 1;
			animation: draw 1.2s cubic-bezier(0.6, 0, 0.3, 1) 1s both;
		}
		.go .names,
		.go .sea-label {
			animation: fade 0.8s ease-out 1.6s both;
		}
		.go .marker {
			animation: drop 0.55s var(--j-spring) calc(1.7s + var(--i) * 0.06s) both;
		}
		.go .splash {
			animation: splash 0.7s ease-out calc(1.85s + var(--i) * 0.06s) both;
		}
		.go .leader {
			stroke-dasharray: 1;
			animation: draw 0.5s ease-out calc(2.1s + var(--i) * 0.04s) both;
		}
		.card-in {
			animation: card-in 0.45s var(--j-ease-out) both;
		}
		.stamp-slot {
			animation: thunk 0.5s var(--j-spring) 0.1s both;
		}
	}
	@keyframes draw {
		from {
			stroke-dashoffset: 1;
		}
		to {
			stroke-dashoffset: 0;
		}
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	@keyframes drop {
		from {
			transform: translateY(-26px) scale(0.6);
			opacity: 0;
		}
	}
	@keyframes splash {
		0% {
			opacity: 0.9;
			transform: scale(0.3);
		}
		100% {
			opacity: 0;
			transform: scale(1.8);
		}
	}
	@keyframes card-in {
		from {
			opacity: 0;
			transform: translateX(10px);
		}
	}
	@keyframes thunk {
		0% {
			opacity: 0;
			transform: scale(1.7) rotate(8deg);
		}
		70% {
			opacity: 1;
			transform: scale(0.96) rotate(-2deg);
		}
	}

	@media (max-width: 900px) {
		.grid {
			grid-template-columns: minmax(0, 1fr);
		}
		.map svg {
			max-height: 70vh;
		}
	}
	@media (max-width: 600px) {
		.label {
			font-size: 28px;
		}
		.names text {
			font-size: 36px;
		}
	}
	@media (max-width: 480px) {
		.card {
			padding-right: 24px;
			padding-top: 156px;
		}
		.stamp-slot {
			right: auto;
			left: 20px;
		}
	}
</style>
