<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { reducedMotion, lowEnd, dataSaver } from '#lib/motion.ts';
	import Crabby, { type CrabbyState } from '#lib/components/Crabby.svelte';
	import Diorama from './Diorama.svelte';
	import JournalNav from './JournalNav.svelte';
	import { HERO, NAV } from '../content/landing.ts';
	import { tr, locale } from '../i18n.ts';
	import { skyAt, istHours, GOLDEN, type Sky } from '../sky.ts';

	// Hero, "Arriving at Ratnagiri" (design/IMPROVEMENT_PLAN.md §4.1): a station nameboard swings down, the name
	// rises out of the sea, the coastal route draws with postmark stops and Crabby walks it to Pawas. Text is real
	// HTML/SVG text and the headline is painted from the first frame (LCP). Reduced motion shows the final state.
	let sky = $state<Sky>(skyAt(istHours()));
	let hero = $state<HTMLElement>();
	let routeH = $state<SVGPathElement>();
	let routeV = $state<SVGPathElement>();
	let scrolled = $state(false);
	let crab = $state({ x: 0, y: 0, state: 'idle' as CrabbyState, on: false, v: false });

	// Bilingual rule (§2.2): in Hindi and Marathi the Devanagari name is the headline and the Latin goes on the board.
	const loc = locale();
	const deva = loc !== 'en';

	type Stop = { x: number; y: number; up: boolean };
	// The coast runs north to south, Jaigad to Pawas. Every stop is a turning point of the line (flat tangent), so a
	// label on the outer side of a stop never touches the route.
	const H_X = [20, 190, 360, 540, 720, 960];
	const H_Y = [70, 38, 104, 38, 104, 70];
	const STOPS_H: Stop[] = H_X.map((x, i) => ({ x, y: H_Y[i], up: H_Y[i] < 60 }));
	// Phones: the same six stops laid down the screen (north at the top), labels alternating out to each side.
	const V_X = [160, 128, 192, 128, 192, 160];
	const STOPS_V: Stop[] = V_X.map((x, i) => ({ x, y: 14 + i * 34, up: i === 5 || x < 160 }));

	const path = (s: Stop[], vertical: boolean) =>
		s.reduce((d, p, i) => {
			if (!i) return `M${p.x} ${p.y}`;
			const q = s[i - 1];
			const m = vertical ? (p.y - q.y) / 2 : (p.x - q.x) / 2;
			return vertical
				? `${d} C${q.x} ${q.y + m} ${p.x} ${p.y - m} ${p.x} ${p.y}`
				: `${d} C${q.x + m} ${q.y} ${p.x - m} ${p.y} ${p.x} ${p.y}`;
		}, '');
	const D_H = path(STOPS_H, false);
	const D_V = path(STOPS_V, true);

	onMount(() => {
		const still = reducedMotion.current;
		const phone = matchMedia('(max-width: 720px)').matches;
		const end = (phone ? STOPS_V : STOPS_H).at(-1)!;
		sky = still ? GOLDEN : skyAt(istHours());
		const tick = setInterval(() => !reducedMotion.current && (sky = skyAt(istHours())), 60_000);
		if (still || !hero) {
			crab = { x: end.x, y: end.y, state: 'idle', on: true, v: phone };
			return () => clearInterval(tick);
		}

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

		// Crabby walks the route once it has drawn (CSS draws it from 1.4 s to 2.8 s), then waves at Pawas.
		let walk = 0;
		const start = setTimeout(() => {
			const route = phone ? routeV : routeH;
			if (!route) return;
			const len = route.getTotalLength();
			const t0 = performance.now();
			const DUR = 3600;
			crab = { x: STOPS_H[0].x, y: STOPS_H[0].y, state: 'scuttle', on: true, v: phone };
			const step = (now: number) => {
				const k = Math.min(1, (now - t0) / DUR);
				const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
				const p = route.getPointAtLength(e * len);
				crab.x = p.x;
				crab.y = p.y;
				if (k < 1) walk = requestAnimationFrame(step);
				else {
					crab.state = 'wave';
					setTimeout(() => (crab.state = 'idle'), 2000);
				}
			};
			walk = requestAnimationFrame(step);
		}, 2900);

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

{#snippet stops(list: Stop[], vertical: boolean)}
	{#each list as s, i (i)}
		{@const end = i === 0 || i === list.length - 1}
		{@const side = vertical ? (s.up ? -1 : 1) : s.up ? -1 : 1}
		<g class="stop" style:--i={i}>
			<!-- a round postmark per stop: ring, dotted inner ring, ink dot -->
			<g class="pin" style:transform-origin="{s.x}px {s.y}px">
				<circle
					cx={s.x}
					cy={s.y}
					r={end ? 9 : 7}
					fill="var(--hero-paper)"
					stroke="currentColor"
					stroke-width="1.6"
				/>
				<circle
					cx={s.x}
					cy={s.y}
					r={end ? 5.6 : 4.2}
					fill="none"
					stroke="currentColor"
					stroke-width=".9"
					stroke-dasharray="1.4 1.3"
				/>
				<circle cx={s.x} cy={s.y} r={end ? 2.4 : 1.8} fill="currentColor" />
			</g>
			{#if vertical}
				<path
					d="M{s.x + side * 11} {s.y} h{side * 5}"
					class="tick"
					stroke="currentColor"
					stroke-width="1.2"
				/>
				<text
					x={s.x + side * 20}
					y={s.y + 4}
					text-anchor={side < 0 ? 'end' : 'start'}
					class="j-caps label">{tr(HERO.route[i]).toLocaleUpperCase('en-IN')}</text
				>
			{:else}
				<path
					d="M{s.x} {s.y + side * 12} v{side * 6}"
					class="tick"
					stroke="currentColor"
					stroke-width="1.2"
				/>
				<text x={s.x} y={s.up ? s.y - 24 : s.y + 34} text-anchor="middle" class="j-caps label"
					>{tr(HERO.route[i]).toLocaleUpperCase('en-IN')}</text
				>
			{/if}
		</g>
	{/each}
{/snippet}

<section
	class={['hero', `ph-${sky.phase}`]}
	bind:this={hero}
	aria-labelledby="hero-title"
	data-photo-slot={HERO.photo.en}
	data-sky={sky.phase}
>
	<Diorama {sky} />
	<JournalNav tone={sky.phase === 'night' ? 'dark' : 'light'} />

	<div class="copy j-wrap">
		<p class="j-caps eyebrow">{tr(HERO.eyebrow)}</p>
		<!-- the station nameboard: the other script of the name, on a yellow board that swings down -->
		<p class={['board', deva && 'latin']} lang={deva ? 'en' : 'mr'}>
			<span>{deva ? HERO.title.toLocaleUpperCase('en-IN') : HERO.deva}</span>
		</p>
		<h1
			id="hero-title"
			class={['j-display', 'title', deva && 'title-deva']}
			lang={deva ? loc : 'en'}
			aria-label={deva ? HERO.deva : HERO.title}
		>
			<span class="mask" aria-hidden="true">
				{#if deva}
					<span class="ch" style:--i={0}>{HERO.deva}</span>
				{:else}
					{#each letters as ch, i (i)}<span class="ch" style:--i={i}>{ch}</span>{/each}
				{/if}
			</span>
		</h1>
		<p class="j-lead sub">{tr(HERO.sub)}</p>

		<div class="route">
			<svg class="route-h" viewBox="-20 0 1020 150" role="img" aria-label={tr(HERO.routeLabel)}>
				<defs>
					<mask id="route-reveal" maskUnits="userSpaceOnUse">
						<path
							class="reveal"
							d={D_H}
							pathLength="1"
							fill="none"
							stroke="#fff"
							stroke-width="12"
						/>
					</mask>
				</defs>
				<path
					bind:this={routeH}
					d={D_H}
					class="line"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-dasharray="5 7"
					stroke-linecap="round"
					mask="url(#route-reveal)"
				/>
				{@render stops(STOPS_H, false)}
				{#if crab.on && !crab.v}
					<g transform="translate({crab.x - 17} {crab.y - 31})">
						<Crabby size={34} state={crab.state} follow={false} speed={0.7} />
					</g>
				{/if}
			</svg>
			<svg class="route-v" viewBox="0 0 320 200" role="img" aria-label={tr(HERO.routeLabel)}>
				<defs>
					<mask id="route-reveal-v" maskUnits="userSpaceOnUse">
						<path
							class="reveal"
							d={D_V}
							pathLength="1"
							fill="none"
							stroke="#fff"
							stroke-width="12"
						/>
					</mask>
				</defs>
				<path
					bind:this={routeV}
					d={D_V}
					fill="none"
					stroke="currentColor"
					stroke-width="1.6"
					stroke-dasharray="4 6"
					stroke-linecap="round"
					mask="url(#route-reveal-v)"
				/>
				{@render stops(STOPS_V, true)}
				{#if crab.on && crab.v}
					<g transform="translate({crab.x - 13} {crab.y - 25})">
						<Crabby size={26} state={crab.state} follow={false} speed={0.7} />
					</g>
				{/if}
			</svg>

			<!-- the tag is an ST bus ticket: the main slip and a torn-off stub that leads into Discover -->
			<a class="ticket" href={resolve('/discover')}>
				<span class="t-main j-caps">{tr(HERO.tag)}</span>
				<span class="t-stub j-caps">{tr(NAV.links[0].label)}<span aria-hidden="true">→</span></span>
			</a>
		</div>
	</div>

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
		padding-bottom: 64px;
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
		top: -2px;
		translate: -50% 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
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
		padding-top: clamp(24px, 5vh, 64px);
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

	/* Station nameboard (§4.1): yellow fill, ink border, an inner rule and two bolts. Hinged at the top. */
	.board {
		position: relative;
		margin-top: 14px;
		padding: 2px 30px 4px;
		background: var(--station);
		color: var(--ink);
		border: 2px solid var(--ink);
		border-radius: 4px;
		box-shadow:
			inset 0 0 0 3px var(--station),
			inset 0 0 0 4.5px var(--ink),
			var(--print-2);
		font-family: var(--j-deva);
		font-size: clamp(24px, 2.6vw, 34px);
		line-height: 1.45;
		transform-origin: 50% 0;
	}
	.board::before,
	.board::after {
		content: '';
		position: absolute;
		top: 50%;
		width: 5px;
		height: 5px;
		margin-top: -2.5px;
		border-radius: 50%;
		background: var(--ink);
	}
	.board::before {
		left: 9px;
	}
	.board::after {
		right: 9px;
	}
	.board.latin {
		padding: 9px 30px 8px;
		font-family: var(--j-text);
		font-weight: 600;
		font-size: clamp(16px, 1.8vw, 22px);
		line-height: 1.2;
		letter-spacing: 0.16em;
	}

	.title {
		margin-top: 6px;
		font-size: clamp(72px, 15vw, 196px);
		line-height: 0.9;
		letter-spacing: -0.035em;
	}
	/* Devanagari headline: Tiro, more line height for the matras, no negative tracking. */
	.title-deva {
		margin-top: 14px;
		font-size: clamp(60px, 13vw, 172px);
		line-height: 1.15;
		letter-spacing: 0;
	}
	/* The letters rise from behind a wave: the wavy bottom edge is a mask, not a box. */
	.mask {
		display: inline-flex;
		padding: 0.06em 0.04em 0.2em;
		-webkit-mask: var(--wave-mask) bottom / 100% 100% no-repeat;
		mask: var(--wave-mask) bottom / 100% 100% no-repeat;
		--wave-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 100' preserveAspectRatio='none'%3E%3Cpath d='M0 0H200V90Q187.5 82 175 90T150 90T125 90T100 90T75 90T50 90T25 90T0 90Z'/%3E%3C/svg%3E");
	}
	.title-deva .mask {
		padding: 0.02em 0.04em 0.12em;
	}
	.ch {
		display: inline-block;
	}
	.sub {
		margin-top: 18px;
		max-width: 560px;
	}

	.route {
		margin-top: clamp(14px, 2.6vh, 30px);
		width: min(980px, 100%);
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.route svg {
		width: 100%;
		height: auto;
		overflow: visible;
	}
	.route-v {
		display: none;
	}
	.label {
		fill: currentColor;
		font-family: var(--j-text);
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 3px;
	}
	:global(.journal:is(:lang(hi), :lang(mr))) .label {
		font-size: 14px;
		letter-spacing: 0;
	}

	/* The ST ticket: a paper slip and a navy stub, torn along a notched line, printed with a hard shadow. */
	.ticket {
		display: inline-flex;
		align-items: stretch;
		min-height: 44px;
		margin-top: 4px;
		text-decoration: none;
		color: var(--navy);
		transform: rotate(-1.2deg);
		filter: drop-shadow(3px 3px 0 var(--ink));
		transition:
			transform 0.2s var(--j-spring),
			filter 0.2s;
	}
	.ticket:hover {
		transform: translate(-1px, -2px) rotate(-1.2deg);
		filter: drop-shadow(5px 5px 0 var(--ink));
	}
	.ticket:active {
		transform: translate(2px, 2px) rotate(-1.2deg);
		filter: drop-shadow(1px 1px 0 var(--ink));
	}
	.t-main,
	.t-stub {
		display: flex;
		align-items: center;
		padding: 10px 20px;
		--n:
			radial-gradient(circle 6px at var(--nx) 0, #0000 97%, #000) top / 100% 51% no-repeat,
			radial-gradient(circle 6px at var(--nx) 100%, #0000 97%, #000) bottom / 100% 51% no-repeat;
		-webkit-mask: var(--n);
		mask: var(--n);
	}
	.t-main {
		--nx: 100%;
		background: var(--paper);
		letter-spacing: 0.24em;
	}
	.t-stub {
		--nx: 0;
		gap: 8px;
		background: var(--navy);
		color: var(--paper);
		letter-spacing: 0.2em;
		white-space: nowrap;
	}

	@media (max-width: 720px) {
		.eyebrow {
			font-size: 11px;
			letter-spacing: 0.18em;
		}
		.board {
			margin-top: 12px;
			padding-inline: 26px;
		}
		.route-h {
			display: none;
		}
		.route-v {
			display: block;
			max-width: 320px;
		}
		.route {
			margin-top: 10px;
		}
		.t-main,
		.t-stub {
			padding: 8px 12px;
			font-size: 10px;
			letter-spacing: 0.16em;
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.eyebrow {
			animation: slide-up 0.8s var(--j-ease-out) 0.05s both;
		}
		.board {
			animation: flip 0.7s var(--j-spring) 0.15s both;
		}
		.ch {
			animation: rise 1s var(--j-ease-out) calc(0.35s + var(--i) * 0.06s) both;
		}
		.sub {
			animation: slide-up 0.9s var(--j-ease-out) 0.9s both;
		}
		.reveal {
			stroke-dasharray: 1;
			animation: draw 1.4s var(--j-ease-inout) 1.4s both;
		}
		.stop .pin {
			animation: postmark 0.38s var(--j-spring) calc(1.45s + var(--i) * 0.26s) both;
		}
		.stop :is(.label, .tick) {
			animation: fade 0.5s ease-out calc(1.6s + var(--i) * 0.26s) both;
		}
		.ticket {
			animation: stamp 0.5s var(--j-spring) 2.9s backwards;
		}
	}
	:global(html[data-lite]) .reveal {
		animation-duration: 0.4s;
	}
	/* transform only: the text is painted from the first frame (it is the LCP element) */
	@keyframes slide-up {
		from {
			transform: translateY(12px);
		}
	}
	@keyframes flip {
		from {
			transform: perspective(600px) rotateX(-92deg);
		}
		to {
			transform: perspective(600px) rotateX(0);
		}
	}
	@keyframes fade {
		from {
			opacity: 0;
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
	/* stamps thunk (§2.5): big and tilted, then pressed in with a little ink spread */
	@keyframes postmark {
		from {
			opacity: 0;
			transform: scale(1.6) rotate(-24deg);
		}
		60% {
			opacity: 1;
			transform: scale(0.94) rotate(-4deg);
		}
	}
	@keyframes stamp {
		from {
			opacity: 0;
			transform: rotate(-8deg) scale(1.4);
		}
	}
</style>
