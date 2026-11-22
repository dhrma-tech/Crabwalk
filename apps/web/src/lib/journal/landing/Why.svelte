<script lang="ts">
	import { resolve } from '$app/paths';
	import { inview } from '../inview.ts';
	import { tr } from '../i18n.ts';
	import { WHY } from '../content/landing.ts';
	import Crabby, { type CrabbyState } from '#lib/components/Crabby.svelte';
	import InkIcon from './InkIcon.svelte';
	import Edge from './Edge.svelte';

	// "Why Crabwalk" (brief §7.5): the offline map is the USP, so it gets a demo. "Turn off network" drops the
	// signal bars and shows "No network", while the pins stay and the trip route keeps drawing; Crabby nods off,
	// then waves: it still works. A demo only: the visitor's real connection is never touched.
	let seen = $state(false);
	let offline = $state(false);
	let crab = $state<CrabbyState>('idle');
	let timer: ReturnType<typeof setTimeout> | undefined;
	// Layer chips filter the pins (places, stays, hotels); fuel / ATM / hospital are outlined like the reference.
	let layers = $state({ places: true, stays: true, hotels: true });

	function toggle() {
		offline = !offline;
		clearTimeout(timer);
		if (offline) {
			crab = 'sleep';
			timer = setTimeout(() => (crab = 'wave'), 1300);
		} else crab = 'idle';
	}

	const PLACES = [
		[300, 54],
		[318, 98],
		[340, 236],
		[380, 366],
		[520, 150]
	];
	const STAYS = [
		[360, 150],
		[410, 290],
		[470, 450],
		[600, 280]
	];
	const HOTELS = [
		[378, 262],
		[344, 118],
		[430, 210]
	];
	const ROUTE = 'M318 112 C 340 150, 360 190, 372 250 S 360 330, 380 380';
	const KEYS = ['places', 'stays', 'hotels'] as const;
	const CARD_ICONS = { hotels: 'hotel', stays: 'stay', places: 'pin' } as const;
</script>

<section class="why" id="map" aria-labelledby="why-title">
	<Edge kind="wave" color="#ffffff" />
	<div class="j-wrap">
		<p class="j-caps eyebrow">{tr(WHY.eyebrow)}</p>
		<h2 id="why-title" class="j-h2">{tr(WHY.title)}</h2>

		<article
			class={['panel', seen && 'go', offline && 'off']}
			use:inview={{ onenter: () => (seen = true) }}
		>
			<div class="text">
				<div>
					<span class="tile"><InkIcon name="map" size={28} stroke={2.6} /></span>
					<h3>{tr(WHY.mapTitle)}</h3>
					<p class="lead">{tr(WHY.mapBody)}</p>
				</div>
				<div class="actions">
					<div class="layers" role="group" aria-label={tr(WHY.layersLabel)}>
						{#each WHY.layers as l, i (i)}
							{#if i < 3}
								<button
									class={['layer', KEYS[i]]}
									aria-pressed={layers[KEYS[i]]}
									onclick={() => (layers[KEYS[i]] = !layers[KEYS[i]])}>{tr(l)}</button
								>
							{:else}
								<span class="layer util">{tr(l)}</span>
							{/if}
						{/each}
					</div>
					<div class="btns">
						<a href={resolve('/map')} class="j-btn paper">{tr(WHY.open)}</a>
						<a href={resolve('/me')} class="j-btn on-dark"
							><InkIcon name="download" size={18} stroke={3} />{tr(WHY.pack)}</a
						>
					</div>
				</div>
			</div>

			<div class="mapbox">
				<svg
					viewBox="0 0 760 560"
					preserveAspectRatio="xMidYMid slice"
					role="img"
					aria-label={tr(WHY.mapAria)}
				>
					<g stroke="#567c8d" stroke-width="1.4" fill="none" opacity=".45" class="seawaves">
						<path d="M20 80 q20 -8 40 0 t40 0" /><path d="M60 200 q20 -8 40 0 t40 0" /><path
							d="M10 330 q20 -8 40 0 t40 0"
						/><path d="M90 450 q20 -8 40 0 t40 0" /><path d="M150 120 q20 -8 40 0 t40 0" /><path
							d="M120 520 q20 -8 40 0 t40 0"
						/>
					</g>
					<path
						d="M300 0 L760 0 L760 560 L360 560 C 350 520, 330 500, 345 470 C 360 440, 320 425, 330 395 C 338 370, 372 362, 360 336 C 348 312, 318 318, 316 290 C 314 262, 350 255, 338 226 C 326 200, 292 205, 294 176 C 296 148, 330 140, 318 112 C 306 86, 278 90, 282 62 C 286 36, 312 30, 300 0 Z"
						fill="#567c8d"
					/>
					<path
						d="M760 0 L760 560 L560 560 C 600 480, 560 420, 610 360 C 650 310, 600 240, 650 180 C 690 130, 640 60, 690 0 Z"
						fill="#4d7083"
					/>
					<path
						d="M338 226 C 380 232, 420 220, 470 236 C 510 248, 540 240, 580 252"
						fill="none"
						stroke="#3a4f66"
						stroke-width="7"
						stroke-linecap="round"
					/>
					<path
						d="M330 395 C 380 400, 420 388, 470 404 C 510 416, 545 410, 585 420"
						fill="none"
						stroke="#3a4f66"
						stroke-width="6"
						stroke-linecap="round"
					/>
					<g fill="none" stroke="#a9c2d4" stroke-width="2" stroke-linecap="round" opacity=".7">
						<path d="M330 70 C 380 110, 360 160, 400 200 S 430 290, 420 330 S 430 440, 450 540" />
						<path d="M400 200 C 480 190, 560 210, 700 190" />
						<path d="M420 330 C 500 320, 600 340, 740 320" />
					</g>
					<!-- planned route: draws in, then keeps flowing (online or not) -->
					<path
						class="route"
						d={ROUTE}
						fill="none"
						stroke="#f5efeb"
						stroke-width="3.5"
						stroke-dasharray="2 9"
						stroke-linecap="round"
					/>
					<circle
						class="walker"
						r="6"
						fill="#b5462b"
						stroke="#f5efeb"
						stroke-width="2"
						style:offset-path="path('{ROUTE}')"
					/>

					{#if layers.places}
						<g fill="#c8d9e6" stroke="#2f4156" stroke-width="2">
							{#each PLACES as [x, y], i (i)}
								<path
									class="pin"
									style:--i={i}
									style:transform-origin="{x}px {y + 40}px"
									d="M{x} {y} c-9 0 -15 7 -15 15 c0 11 15 25 15 25 s15 -14 15 -25 c0 -8 -6 -15 -15 -15z"
								/>
							{/each}
						</g>
					{/if}
					{#if layers.stays}
						<g fill="#f5efeb" stroke="#2f4156" stroke-width="2">
							{#each STAYS as [x, y], i (i)}
								<circle
									class="pin"
									style:--i={i + 5}
									style:transform-origin="{x}px {y}px"
									cx={x}
									cy={y}
									r="10"
								/>
							{/each}
						</g>
					{/if}
					{#if layers.hotels}
						<g fill="#ffffff" stroke="#2f4156" stroke-width="2">
							{#each HOTELS as [x, y], i (i)}
								<rect
									class="pin"
									style:--i={i + 9}
									style:transform-origin="{x + 9}px {y + 9}px"
									{x}
									{y}
									width="18"
									height="18"
									rx="4"
								/>
							{/each}
						</g>
					{/if}
					<g
						font-family="Instrument Sans, sans-serif"
						font-size="13"
						font-weight="600"
						fill="#f5efeb"
						letter-spacing="1.5"
					>
						<text x="232" y="60">JAIGAD</text>
						<text x="190" y="118">GANPATIPULE</text>
						<text x="250" y="262">RATNADURG</text>
						<text x="300" y="400">PAWAS</text>
						<text x="540" y="168">MARLESHWAR</text>
					</g>
					<text x="440" y="300" font-family="Gloock, Georgia, serif" font-size="26" fill="#f5efeb"
						>Ratnagiri</text
					>
					<text
						x="70"
						y="290"
						font-family="Instrument Sans, sans-serif"
						font-size="12"
						font-weight="600"
						letter-spacing="4"
						fill="#8aa7b9">ARABIAN SEA</text
					>
				</svg>

				<div class="top">
					<span class="search"
						><svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							class="j-ink"
							stroke="#436475"
							stroke-width="1.8"
							aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg
						>{tr(WHY.search)}</span
					>
					<span class="status">
						<span class="bars" role="img" aria-label="{tr(WHY.signal)}: {offline ? '0' : '4'}/4">
							{#each [1, 2, 3, 4] as b (b)}<i style:--b={b}></i>{/each}
						</span>
						{#if offline}<span class="nonet">{tr(WHY.noNetwork)}</span>{/if}
						<span class="chip"
							><svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								class="j-ink"
								stroke-width="2.4"
								aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg
							>{tr(WHY.offlineChip)}</span
						>
					</span>
				</div>

				<div class="demo">
					<div class="crabby-row">
						<Crabby size={84} state={crab} follow={!offline} />
						{#if offline}
							<p class="bubble" role="status">{tr(WHY.stillWorks)}</p>
						{/if}
					</div>
					<button class="toggle" role="switch" aria-checked={offline} onclick={toggle}>
						<span class="track"><span class="knob"></span></span>
						{tr(WHY.toggle)}
					</button>
					<p class="note">{tr(WHY.demoNote)}</p>
				</div>

				<div class="legend">
					<span><i class="lg-place"></i>{tr(WHY.legend.places)}</span>
					<span><i class="lg-stay"></i>{tr(WHY.legend.stays)}</span>
					<span><i class="lg-hotel"></i>{tr(WHY.legend.hotels)}</span>
					<span><i class="lg-trip"></i>{tr(WHY.legend.trip)}</span>
				</div>
			</div>
		</article>

		<div class="kinds">
			{#each WHY.kinds as k (k.key)}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- static app paths from content -->
				<a href={k.href} class="kind">
					<div class="kart" aria-hidden="true">
						<svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice">
							<rect width="400" height="250" fill={k.key === 'stays' ? '#a9c2d4' : '#c8d9e6'} />
							<g class="k0"><circle cx="320" cy="70" r="26" fill="#f5efeb" /></g>
							<g class="k1"
								><path
									d="M-20 170 C 100 140, 220 160, 420 135 L420 260 L-20 260 Z"
									fill="#567c8d"
								/></g
							>
							<g class="k2" fill="#2f4156">
								{#if k.key === 'hotels'}
									<path d="M150 250 L150 90 L250 90 L250 250 Z" />
									<path
										d="M165 105 h20 v18 h-20 z M215 105 h20 v18 h-20 z M165 140 h20 v18 h-20 z M215 140 h20 v18 h-20 z M165 175 h20 v18 h-20 z M215 175 h20 v18 h-20 z"
										fill="#c8d9e6"
									/>
									<path d="M142 90 h116 v-10 h-116 z" />
								{:else if k.key === 'stays'}
									<path
										d="M120 170 L200 112 L280 170 Z"
										fill="#b5462b"
										stroke="#2f4156"
										stroke-width="3"
										stroke-linejoin="round"
									/>
									<path d="M132 168 L132 250 L268 250 L268 168 Z" />
									<path d="M186 200 h28 v50 h-28 z" fill="#f5efeb" />
									<path
										d="M60 250 C58 210 64 176 78 146 L82 148 C70 178 66 212 68 250 Z M80 146 C62 134 44 138 30 150 C48 144 64 144 80 150 Z M80 146 C86 128 102 120 120 122 C104 130 92 138 82 150 Z"
									/>
								{:else}
									<path
										d="M90 250 L90 150 L110 150 L110 135 L130 135 L130 150 L160 150 L160 135 L180 135 L180 150 L210 150 L210 135 L230 135 L230 150 L250 150 L250 250 Z"
									/>
									<path d="M156 250 v-40 a14 14 0 0 1 28 0 v40 z" fill="#c8d9e6" />
									<path
										d="M170 135 V100 l18 7 -18 7"
										fill="none"
										stroke="#2f4156"
										stroke-width="3"
									/>
								{/if}
							</g>
						</svg>
						<span class="kicon"><InkIcon name={CARD_ICONS[k.key]} size={24} stroke={2.6} /></span>
					</div>
					<div class="kfoot">
						<div>
							<h3>{tr(k.title)}</h3>
							<p>{tr(k.desc)}</p>
						</div>
						<span class="karrow" aria-hidden="true"
							><InkIcon name="arrow" size={18} stroke={3.4} /></span
						>
					</div>
				</a>
			{/each}
		</div>
	</div>
</section>

<style>
	.why {
		position: relative;
		z-index: 4;
		background: var(--white);
		padding: 72px 0 104px;
	}
	.eyebrow {
		color: var(--muted);
	}
	h2 {
		margin-top: 10px;
		max-width: 16ch;
	}
	.panel {
		margin-top: 48px;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.7fr);
		gap: 40px;
		padding: 40px;
		border-radius: 32px;
		background: var(--navy);
		color: var(--beige);
		overflow: hidden;
	}
	.text {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 32px;
	}
	.tile {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 52px;
		height: 52px;
		border-radius: 16px;
		background: var(--muted);
	}
	h3 {
		font-family: var(--j-display);
		font-weight: 400;
	}
	.text h3 {
		margin-top: 24px;
		font-size: clamp(32px, 3.4vw, 46px);
		line-height: 1.05;
		text-wrap: balance;
	}
	.lead {
		margin-top: 16px;
		color: var(--sky);
		font-size: 17px;
	}
	.actions {
		display: grid;
		gap: 18px;
	}
	.layers {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.layer {
		display: inline-flex;
		align-items: center;
		min-height: 40px;
		padding: 0 14px;
		border-radius: 999px;
		border: 1.5px solid var(--teal);
		background: transparent;
		color: var(--beige);
		font-size: 14px;
		font-weight: 600;
		transition:
			background 0.2s,
			color 0.2s;
	}
	.layer[aria-pressed='true'].places {
		background: var(--sky);
		color: var(--navy);
		border-color: var(--sky);
	}
	.layer[aria-pressed='true'].stays {
		background: var(--beige);
		color: var(--navy);
		border-color: var(--beige);
	}
	.layer[aria-pressed='true'].hotels {
		background: var(--white);
		color: var(--navy);
		border-color: var(--white);
	}
	.layer.util {
		font-weight: 500;
	}
	.btns {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}
	.mapbox {
		position: relative;
		min-height: 560px;
		border-radius: 24px;
		overflow: hidden;
		background: #3a4f66;
	}
	.mapbox > svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.top {
		position: absolute;
		top: 16px;
		left: 16px;
		right: 16px;
		display: flex;
		justify-content: space-between;
		gap: 10px;
		flex-wrap: wrap;
	}
	.search {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		border-radius: 999px;
		background: var(--white);
		color: var(--navy);
		font-size: 14px;
		box-shadow: 0 6px 18px rgb(31 44 59 / 0.25);
	}
	.status {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.bars {
		display: inline-flex;
		align-items: end;
		gap: 2px;
		height: 18px;
		padding: 0 4px;
	}
	.bars i {
		width: 4px;
		height: calc(var(--b) * 4px);
		border-radius: 1px;
		background: var(--beige);
		transition:
			height 0.35s var(--j-ease) calc((4 - var(--b)) * 70ms),
			opacity 0.35s calc((4 - var(--b)) * 70ms);
	}
	.off .bars i {
		height: 2px;
		opacity: 0.4;
	}
	.nonet {
		padding: 8px 12px;
		border-radius: 999px;
		background: var(--laterite);
		color: var(--white);
		font-size: 13px;
		font-weight: 600;
		animation: pop 0.4s var(--j-spring) both;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		border-radius: 999px;
		background: var(--navy);
		border: 1px solid var(--teal);
		font-size: 13px;
		font-weight: 600;
	}
	.demo {
		position: absolute;
		right: 16px;
		bottom: 16px;
		display: grid;
		justify-items: end;
		gap: 6px;
		max-width: 300px;
	}
	.crabby-row {
		display: flex;
		align-items: end;
		gap: 8px;
		flex-direction: row-reverse;
	}
	.bubble {
		padding: 10px 14px;
		border-radius: 18px 18px 4px 18px;
		background: var(--beige);
		color: var(--navy);
		font-size: 14px;
		line-height: 1.4;
		box-shadow: 3px 3px 0 var(--ink);
		animation: pop 0.45s var(--j-spring) both;
	}
	.toggle {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		padding: 0 16px 0 8px;
		border: 1.5px solid var(--ink);
		border-radius: 999px;
		background: var(--white);
		color: var(--navy);
		font-size: 14px;
		font-weight: 600;
		box-shadow: 3px 3px 0 var(--ink);
	}
	.track {
		position: relative;
		width: 40px;
		height: 24px;
		border-radius: 999px;
		background: var(--line);
		transition: background 0.2s;
	}
	.knob {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--white);
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
		transition: transform 0.3s var(--j-spring);
	}
	.off .track {
		background: var(--laterite);
	}
	.off .knob {
		transform: translateX(16px);
	}
	.note {
		font-size: 11px;
		color: var(--sky);
	}
	.legend {
		position: absolute;
		left: 16px;
		bottom: 16px;
		display: flex;
		flex-wrap: wrap;
		gap: 14px;
		max-width: calc(100% - 340px);
		padding: 12px 16px;
		border-radius: 18px;
		background: var(--white);
		color: var(--navy);
		font-size: 13px;
		font-weight: 600;
		box-shadow: 0 6px 18px rgb(31 44 59 / 0.25);
	}
	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.legend i {
		display: inline-block;
		width: 12px;
		height: 12px;
		border: 2px solid var(--navy);
	}
	.lg-place {
		border-radius: 999px 999px 999px 0;
		transform: rotate(-45deg);
		background: var(--sky);
	}
	.lg-stay {
		border-radius: 999px;
		background: var(--beige);
	}
	.lg-hotel {
		border-radius: 3px;
		background: var(--white);
	}
	.lg-trip {
		width: 18px !important;
		height: 0 !important;
		border-width: 3px 0 0 !important;
		border-style: dotted !important;
	}
	.walker {
		offset-distance: 0%;
		offset-rotate: 0deg;
		opacity: 0;
	}

	@media (prefers-reduced-motion: no-preference) {
		.panel:not(.go) .pin {
			opacity: 0;
		}
		.go .pin {
			animation: drop 0.6s var(--j-spring) calc(0.3s + var(--i) * 0.08s) both;
		}
		.panel:not(.go) .route {
			opacity: 0;
		}
		.go .route {
			animation:
				fade 0.4s ease-out 1.2s both,
				march 1.6s linear 1.2s infinite;
		}
		.go .walker {
			animation: walk 6s ease-in-out 1.6s infinite;
		}
		.kart :is(.k0, .k1, .k2) {
			transition: transform 0.6s var(--j-ease-out);
		}
		.kind:hover .k0 {
			transform: translate(-10px, 4px);
		}
		.kind:hover .k1 {
			transform: translateX(8px);
		}
		.kind:hover .k2 {
			transform: translateX(-12px) translateY(-4px);
		}
	}
	@keyframes drop {
		from {
			opacity: 0;
			transform: translateY(-40px) scale(0.5);
		}
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	@keyframes march {
		to {
			stroke-dashoffset: -22;
		}
	}
	@keyframes walk {
		0% {
			offset-distance: 0%;
			opacity: 0;
		}
		10%,
		90% {
			opacity: 1;
		}
		100% {
			offset-distance: 100%;
			opacity: 0;
		}
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: scale(0.7) translateY(6px);
		}
	}

	.kinds {
		margin-top: 18px;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
		gap: 18px;
	}
	.kind {
		display: flex;
		flex-direction: column;
		gap: 18px;
		padding: 14px;
		border-radius: 28px;
		background: var(--beige);
		border: 1.5px solid transparent;
		text-decoration: none;
		transition: border-color 0.25s;
	}
	.kind:hover {
		border-color: var(--navy);
	}
	.kart {
		position: relative;
		aspect-ratio: 16 / 10;
		border-radius: 20px;
		overflow: hidden;
	}
	.kart svg {
		position: absolute;
		inset: -8px -20px;
		width: calc(100% + 40px);
		height: calc(100% + 16px);
	}
	.kicon {
		position: absolute;
		top: 12px;
		left: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 14px;
		background: var(--white);
	}
	.kfoot {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 12px;
		padding: 0 10px 12px;
	}
	.kfoot h3 {
		font-size: 32px;
		line-height: 1.05;
	}
	.kfoot p {
		margin-top: 8px;
		font-size: 15px;
		color: var(--muted);
	}
	.karrow {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 999px;
		background: var(--navy);
		color: var(--white);
		transition: transform 0.4s var(--j-spring);
	}
	.kind:hover .karrow {
		transform: rotate(45deg);
	}

	@media (max-width: 1000px) {
		.panel {
			grid-template-columns: minmax(0, 1fr);
			padding: 24px;
		}
		.mapbox {
			min-height: 520px;
		}
	}
	@media (max-width: 640px) {
		.mapbox {
			min-height: 540px;
		}
		.legend {
			max-width: none;
			left: 12px;
			right: 12px;
			bottom: 12px;
			gap: 10px;
			padding: 10px 12px;
			font-size: 12px;
		}
		.demo {
			right: 12px;
			bottom: 64px;
			max-width: calc(100% - 24px);
		}
		.note {
			display: none;
		}
		.search {
			display: none;
		}
	}
</style>
