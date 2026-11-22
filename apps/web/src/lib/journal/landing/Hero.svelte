<script lang="ts">
	import { onMount } from 'svelte';
	import { reducedMotion, lowEnd, dataSaver } from '#lib/motion.ts';
	import Crabby, { type CrabbyState } from '#lib/components/Crabby.svelte';
	import Diorama from './Diorama.svelte';
	import JournalNav from './JournalNav.svelte';
	import { HERO } from '../content/landing.ts';
	import { tr } from '../i18n.ts';
	import { skyAt, istHours, GOLDEN, type Sky } from '../sky.ts';

	// Hero (brief §7.1): living coast diorama with the real Ratnagiri sky, the headline rising out of a wave,
	// रत्नागिरी writing itself, then the coastal route drawing with a tiny Crabby scuttling to Pawas.
	// Text is real HTML/SVG text. Entrance is CSS (starts at first paint, no wait for hydration); reduced motion
	// shows the final state and a golden-hour sky.
	let sky = $state<Sky>(skyAt(istHours()));
	let hero = $state<HTMLElement>();
	let route = $state<SVGPathElement>();
	let scrolled = $state(false);
	let crab = $state({ x: 20, y: 70, state: 'idle' as CrabbyState, on: false, flip: false });

	const STOPS = [
		{ x: 20, y: 70, below: true, end: true },
		{ x: 190, y: 60, below: false },
		{ x: 360, y: 80, below: true },
		{ x: 540, y: 60, below: false },
		{ x: 720, y: 80, below: true },
		{ x: 960, y: 70, below: true, end: true }
	];
	const ROUTE_D =
		'M20 70 C 90 10, 150 10, 190 60 S 300 125, 360 80 S 470 15, 540 60 S 650 130, 720 80 S 830 20, 960 70';

	onMount(() => {
		const still = reducedMotion.current;
		sky = still ? GOLDEN : skyAt(istHours());
		const tick = setInterval(() => !reducedMotion.current && (sky = skyAt(istHours())), 60_000);
		if (still || !hero) return () => clearInterval(tick);

		// Parallax: pointer (desktop) and scroll move the layers through CSS vars, one rAF per frame at most.
		const lite = lowEnd() || dataSaver.current;
		let raf = 0;
		let mx = 0;
		let my = 0;
		const apply = () => {
			raf = 0;
			const y = Math.min(scrollY, innerHeight * 1.2);
			hero!.style.setProperty('--sy', String(y));
			if (!lite) {
				hero!.style.setProperty('--mx', mx.toFixed(3));
				hero!.style.setProperty('--my', my.toFixed(3));
			}
		};
		const queue = () => {
			if (scrollY > 40) scrolled = true;
			raf ||= requestAnimationFrame(apply);
		};
		const move = (e: PointerEvent) => {
			if (e.pointerType !== 'mouse') return;
			mx = (e.clientX / innerWidth) * 2 - 1;
			my = (e.clientY / innerHeight) * 2 - 1;
			queue();
		};
		addEventListener('pointermove', move, { passive: true });
		addEventListener('scroll', queue, { passive: true });

		// The tiny Crabby walks the route once it has drawn (CSS draws it from 1.5 s to 3.3 s).
		let walk = 0;
		const start = setTimeout(() => {
			if (!route) return;
			const len = route.getTotalLength();
			const t0 = performance.now();
			const DUR = 4200;
			crab.on = true;
			crab.state = 'scuttle';
			const step = (now: number) => {
				const k = Math.min(1, (now - t0) / DUR);
				const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
				const p = route!.getPointAtLength(e * len);
				crab.x = p.x;
				crab.y = p.y;
				if (k < 1) walk = requestAnimationFrame(step);
				else {
					crab.state = 'wave';
					setTimeout(() => (crab.state = 'idle'), 2000);
				}
			};
			walk = requestAnimationFrame(step);
		}, 3300);

		return () => {
			clearInterval(tick);
			clearTimeout(start);
			cancelAnimationFrame(walk);
			cancelAnimationFrame(raf);
			removeEventListener('pointermove', move);
			removeEventListener('scroll', queue);
		};
	});

	const letters = HERO.title.split('');
</script>

<section class={['hero', `ph-${sky.phase}`]} bind:this={hero} aria-labelledby="hero-title">
	<Diorama {sky} />
	<JournalNav tone={sky.phase === 'night' ? 'dark' : 'light'} />

	<div class="copy j-wrap">
		<p class="j-caps eyebrow">{tr(HERO.eyebrow)}</p>
		<p class="deva" lang="mr">
			<span class="sr-only">{HERO.deva}</span>
			<svg viewBox="0 0 300 64" aria-hidden="true">
				<text x="150" y="46" text-anchor="middle">{HERO.deva}</text>
			</svg>
		</p>
		<h1 id="hero-title" class="j-display title" lang="en" aria-label={HERO.title}>
			<span class="mask" aria-hidden="true">
				{#each letters as ch, i (i)}<span class="ch" style:--i={i}>{ch}</span>{/each}
			</span>
		</h1>
		<p class="j-lead sub">{tr(HERO.sub)}</p>

		<div class="route">
			<svg viewBox="-20 0 1020 150" role="img" aria-label={tr(HERO.routeLabel)}>
				<defs>
					<mask id="route-reveal" maskUnits="userSpaceOnUse">
						<path
							class="reveal"
							d={ROUTE_D}
							pathLength="1"
							fill="none"
							stroke="#fff"
							stroke-width="10"
						/>
					</mask>
				</defs>
				<path
					bind:this={route}
					d={ROUTE_D}
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-dasharray="5 7"
					stroke-linecap="round"
					mask="url(#route-reveal)"
				/>
				{#each STOPS as s, i (i)}
					<g class="stop" style:--i={i}>
						<g class="pin" style:transform-origin="{s.x}px {s.y}px">
							{#if s.end}
								<circle
									cx={s.x}
									cy={s.y}
									r="7"
									fill="var(--hero-paper)"
									stroke="currentColor"
									stroke-width="2.2"
								/>
								<circle cx={s.x} cy={s.y} r="2.4" fill="currentColor" />
							{:else}
								<circle cx={s.x} cy={s.y} r="4.5" fill="currentColor" />
							{/if}
						</g>
						<text
							x={s.x}
							y={s.below ? s.y + 36 : s.y - 22}
							text-anchor="middle"
							class="j-caps label"
							font-size="12">{tr(HERO.route[i]).toLocaleUpperCase('en-IN')}</text
						>
					</g>
				{/each}
				{#if crab.on}
					<g transform="translate({crab.x - 17} {crab.y - 30})">
						<Crabby size={34} state={crab.state} follow={false} speed={0.7} />
					</g>
				{/if}
			</svg>
			<p class="tag j-caps">{tr(HERO.tag)}</p>
		</div>
	</div>

	<p class="photo j-caps">{tr(HERO.photo)} · {tr(HERO.sky[sky.phase])}</p>

	<!-- shoreline into the paper, and the notch hanging from the sea with the scroll arrow -->
	<svg class="shore" viewBox="0 0 1440 40" preserveAspectRatio="none" aria-hidden="true">
		<path
			d="M0 22 C 160 6, 300 30, 470 18 S 760 2, 930 20 S 1240 34, 1440 14 L1440 40 L0 40 Z"
			fill="var(--beige)"
		/>
		<path
			d="M0 22 C 160 6, 300 30, 470 18 S 760 2, 930 20 S 1240 34, 1440 14"
			fill="none"
			stroke="#f5efeb"
			stroke-width="3"
			opacity=".7"
			transform="translate(0 -5)"
		/>
	</svg>
	<div class="notch">
		<svg viewBox="0 0 240 48" aria-hidden="true"
			><path
				d="M0 0 C 44 0, 56 4, 72 20 C 88 38, 100 46, 120 46 C 140 46, 152 38, 168 20 C 184 4, 196 0, 240 0 Z"
				fill={sky.sea}
			/></svg
		>
		<a href="#talukas" class={['arrow', !scrolled && 'pulse']} aria-label={tr(HERO.scroll)}>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg
			>
		</a>
	</div>
</section>

<style>
	.hero {
		--hero-ink: var(--navy);
		--hero-soft: var(--muted);
		--hero-paper: var(--sky);
		position: relative;
		min-height: max(760px, 100svh);
		display: flex;
		flex-direction: column;
		color: var(--hero-ink);
		isolation: isolate;
		z-index: 2;
		padding-bottom: 40px;
	}
	.shore {
		position: absolute;
		z-index: 6;
		left: 0;
		bottom: -1px;
		width: 100%;
		height: 40px;
	}
	.notch {
		position: absolute;
		z-index: 7;
		left: 50%;
		bottom: -47px;
		width: 240px;
		height: 48px;
		translate: -50% 0;
	}
	.notch svg {
		display: block;
		width: 100%;
		height: 100%;
	}
	.arrow {
		position: absolute;
		left: 50%;
		top: 2px;
		translate: -50% 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 999px;
		border: 1.5px solid #fff;
		color: #fff;
	}
	@media (prefers-reduced-motion: no-preference) {
		.pulse {
			animation: pulse 4s ease-in-out 3.5s infinite;
		}
	}
	@keyframes pulse {
		0%,
		70%,
		100% {
			transform: none;
			box-shadow: 0 0 0 0 rgb(255 255 255 / 0.5);
		}
		80% {
			transform: translateY(4px);
			box-shadow: 0 0 0 8px rgb(255 255 255 / 0);
		}
	}
	.ph-night {
		--hero-ink: var(--beige);
		--hero-soft: var(--sky);
		--hero-paper: #2f4156;
	}
	.copy {
		position: relative;
		z-index: 5;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding-top: clamp(28px, 6vh, 72px);
		pointer-events: none;
	}
	.copy :global(a),
	.copy :global(button) {
		pointer-events: auto;
	}
	.eyebrow {
		color: var(--hero-soft);
		letter-spacing: 0.32em;
	}
	.deva {
		margin-top: 10px;
		width: min(220px, 60vw);
		line-height: 0;
	}
	.deva svg {
		width: 100%;
		height: auto;
		overflow: visible;
	}
	.deva text {
		font-family: var(--j-deva);
		font-size: 46px;
		fill: var(--hero-soft);
		stroke: var(--hero-soft);
		stroke-width: 0.7;
		stroke-dasharray: 340;
		stroke-dashoffset: 0;
	}
	.title {
		margin-top: -2px;
		font-size: clamp(72px, 15vw, 196px);
		line-height: 0.9;
		letter-spacing: -0.035em;
	}
	/* The letters rise from behind a wave: the wavy bottom edge is a mask, not a box. */
	.mask {
		display: inline-flex;
		padding: 0.06em 0.04em 0.2em;
		-webkit-mask: var(--wave-mask) bottom / 100% 100% no-repeat;
		mask: var(--wave-mask) bottom / 100% 100% no-repeat;
		--wave-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 100' preserveAspectRatio='none'%3E%3Cpath d='M0 0H200V90Q187.5 82 175 90T150 90T125 90T100 90T75 90T50 90T25 90T0 90Z'/%3E%3C/svg%3E");
	}
	.ch {
		display: inline-block;
	}
	.sub {
		margin-top: 18px;
		max-width: 560px;
	}
	.route {
		margin-top: clamp(16px, 3vh, 32px);
		width: min(980px, 100%);
	}
	.route svg {
		width: 100%;
		height: auto;
		overflow: visible;
	}
	.label {
		fill: currentColor;
		font-family: var(--j-text);
		font-weight: 600;
		letter-spacing: 3px;
	}
	.tag {
		display: inline-block;
		margin-top: 2px;
		padding: 10px 22px;
		background: var(--hero-ink);
		color: var(--hero-paper);
		letter-spacing: 0.3em;
		/* a stamped label: slightly rotated, with a misregistered laterite edge */
		transform: rotate(-1.2deg);
		box-shadow: 3px 3px 0 var(--laterite);
	}
	.photo {
		position: absolute;
		z-index: 5;
		left: var(--j-gutter);
		bottom: 52px;
		font-size: 10px;
		letter-spacing: 0.14em;
		color: var(--beige);
		opacity: 0.8;
	}

	@media (max-width: 720px) {
		.route svg {
			display: none;
		}
		.route {
			margin-top: 20px;
		}
		.tag {
			font-size: 10px;
			padding: 8px 14px;
			letter-spacing: 0.22em;
		}
		.photo {
			display: none;
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.eyebrow {
			animation: slide-up 0.8s var(--j-ease-out) 0.1s both;
		}
		/* English pages: रत्नागिरी writes itself once its face has arrived (after load, see whenDevaReady). */
		:global(.journal.deva-ready) .deva text {
			animation:
				write 1.8s cubic-bezier(0.6, 0, 0.3, 1) both,
				ink-fill 0.6s ease-out 1.4s both;
		}
		:global(.journal:not(.deva-ready)) .deva text {
			opacity: 0;
		}
		:global(.journal:is(:lang(hi), :lang(mr))) .deva text {
			opacity: 1;
		}
		.ch {
			animation: rise 1s var(--j-ease-out) calc(0.35s + var(--i) * 0.06s) both;
		}
		.sub {
			animation: slide-up 0.9s var(--j-ease-out) 0.9s both;
		}
		.reveal {
			stroke-dasharray: 1;
			animation: draw 1.8s cubic-bezier(0.55, 0, 0.35, 1) 1.5s both;
		}
		.stop .pin {
			animation: pop 0.5s var(--j-spring) calc(1.55s + var(--i) * 0.32s) both;
		}
		.stop .label {
			animation: fade 0.6s ease-out calc(1.7s + var(--i) * 0.32s) both;
		}
		.tag {
			animation: stamp 0.5s var(--j-spring) 3.3s both;
		}
	}
	/* transform only: the text is painted from the first frame (it is the LCP element) */
	@keyframes slide-up {
		from {
			transform: translateY(12px);
		}
	}
	@keyframes fade-up {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	@keyframes write {
		from {
			stroke-dashoffset: 340;
		}
	}
	@keyframes ink-fill {
		from {
			fill-opacity: 0;
		}
	}
	@keyframes rise {
		from {
			transform: translateY(105%) rotate(6deg);
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
	@keyframes pop {
		from {
			transform: scale(0);
		}
	}
	@keyframes stamp {
		from {
			opacity: 0;
			transform: rotate(-8deg) scale(1.4);
		}
	}
</style>
