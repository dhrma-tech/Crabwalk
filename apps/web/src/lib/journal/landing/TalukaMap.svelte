<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { reducedMotion } from '#lib/motion.ts';
	import { inview } from '../inview.ts';
	import { tr, locale } from '../i18n.ts';
	import { MAP } from '../content/landing.ts';
	import { TALUKAS, MAP_PLACES, DISTRICT, type TalukaKey } from '../content/talukas.ts';
	import { TALUKA_GEO, project } from '../content/talukaGeo.ts';
	import Stamp from './Stamp.svelte';
	import InkIcon from './InkIcon.svelte';

	// "Discover Ratnagiri" (design/IMPROVEMENT_PLAN.md §4.2): real OSM boundaries. On entering: outline draws, then
	// the taluka borders, markers drop with an ink splash, leader lines run out and the labels type in. Picking a
	// taluka bleeds a pitted ink wash out from the tap, slides in its postcard, thunks the stamp and rolls a postmark
	// with today's date across it. Hover previews in riso halftone. Phones: map first, stamp strip, then the postcard.
	let selected = $state<TalukaKey>(DISTRICT.defaultTaluka);
	let hovered = $state<TalukaKey | null>(null);
	const shown = $derived(hovered ?? selected);
	const tal = $derived(TALUKAS.find((t) => t.key === shown)!);
	const idx = $derived(TALUKAS.findIndex((t) => t.key === shown) + 1);
	let started = $state(false);
	let typed = $state(99);
	let narrow = $state(false);
	let bleed = $state({ x: 0, y: 0, n: 0 });
	let map = $state<SVGSVGElement>();
	let strip = $state<HTMLElement>();
	// Postmark date: today in IST, set on the client so it is never a cached or server-side date.
	let pm = $state<{ day: string; month: string; year: string } | null>(null);

	const H = TALUKA_GEO.height;
	const W = TALUKA_GEO.width;
	const LABEL_DY: Record<string, number> = { 'Unhale springs': -16, 'Dhoot-Papeshwar': 16 };
	// Name anchors: the centre (and tilt) that keeps the whole name box inside each taluka, clear of the place
	// markers, with the widest margin (a grid search over the generated boundaries); thin coastal talukas read along their length.
	// Mandangad's strip is too thin for its name, so it is labelled just outside with a leader line.
	const NAME_AT: Record<TalukaKey, [x: number, y: number, deg: number]> = {
		mandangad: [258, 64, 0],
		dapoli: [134, 176, 0],
		khed: [312, 272, 0],
		chiplun: [346, 441, 0],
		guhagar: [174, 470, 75],
		sangameshwar: [426, 702, 45],
		ratnagiri: [241, 749, 75],
		lanja: [400, 894, 0],
		rajapur: [321, 1081, 0]
	};
	// Phones keep the six coastal labels; the other places stay as markers.
	const PHONE = new Set([
		'Velas',
		'Suvarnadurg',
		'Jaigad Fort',
		'Ganpatipule',
		'Ratnagiri city',
		'Pawas'
	]);
	const places = $derived(
		MAP_PLACES.map((p, i) => {
			const [x, y] = project(p.lon, p.lat);
			const ly = y + (LABEL_DY[p.name.en] ?? 0);
			const tx = p.side === 'w' ? (narrow ? -12 : -24) : W + 10;
			return { ...p, x, y, ly, i, tx, label: !narrow || PHONE.has(p.name.en) };
		})
	);

	function pick(key: TalukaKey, e?: MouseEvent) {
		if (key === selected) return;
		const g = TALUKA_GEO.talukas[key];
		const m = e && map?.getScreenCTM();
		const { x, y } = m
			? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
			: { x: g.cx, y: g.cy };
		bleed = { x, y, n: bleed.n + 1 };
		selected = key;
		// Keep the chosen stamp in view on the phone strip (map taps and strip taps stay in sync).
		const b = strip?.querySelector<HTMLElement>(`[data-key="${key}"]`);
		if (b && strip && strip.scrollWidth > strip.clientWidth)
			strip.scrollTo({
				left: b.offsetLeft - (strip.clientWidth - b.offsetWidth) / 2,
				behavior: reducedMotion.current ? 'auto' : 'smooth'
			});
	}

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
		const loc = locale();
		const f = (o: Intl.DateTimeFormatOptions) =>
			new Intl.DateTimeFormat(`${loc}-IN`, { timeZone: 'Asia/Kolkata', ...o }).format(new Date());
		pm = { day: f({ day: 'numeric' }), month: f({ month: 'short' }), year: f({ year: 'numeric' }) };
		const mq = matchMedia('(max-width: 600px)');
		const set = () => (narrow = mq.matches);
		set();
		mq.addEventListener('change', set);
		return () => mq.removeEventListener('change', set);
	});
	const slide = (x: number) => ({ x, duration: reducedMotion.current ? 0 : 220 });
</script>

<section class="talukas" id="talukas" aria-labelledby="talukas-title">
	<div class="j-wrap grid">
		<div class="head">
			<span class="rule" aria-hidden="true"></span>
			<h2 id="talukas-title" class="j-h2">{tr(MAP.title)}</h2>
			<p class="j-lead body">{tr(MAP.body)}</p>
		</div>

		<div
			class="map j-lazy"
			style:--j-lazy-h="760px"
			use:inview={{ onenter: enter, margin: '0px 0px -25% 0px' }}
		>
			<svg
				bind:this={map}
				viewBox={narrow ? `-282 -20 894 ${H + 40}` : `-200 -20 1000 ${H + 40}`}
				role="img"
				aria-label={tr(MAP.aria).replace('{name}', tr(tal.name))}
				class={[started && 'go', narrow && 'narrow']}
			>
				<defs>
					<pattern id="sea-dots" width="9" height="9" patternUnits="userSpaceOnUse">
						<circle cx="2.5" cy="2.5" r="1.5" fill="#8aa7b9" />
						<circle cx="7" cy="7" r="1.5" fill="#8aa7b9" />
					</pattern>
					<!-- riso halftone for the hover preview, laterite pits for the chosen taluka (§2.4) -->
					<pattern id="halftone" width="7" height="7" patternUnits="userSpaceOnUse">
						<circle cx="1.75" cy="1.75" r="1.5" fill="#567c8d" />
						<circle cx="5.25" cy="5.25" r="1.5" fill="#567c8d" />
					</pattern>
					<pattern id="pits" width="23" height="19" patternUnits="userSpaceOnUse">
						<ellipse cx="4" cy="4" rx="2" ry="1.3" fill="#2f4156" />
						<ellipse cx="15" cy="11" rx="1.4" ry="1" fill="#2f4156" />
						<circle cx="19" cy="3" r=".9" fill="#2f4156" />
						<circle cx="8" cy="15" r="1.1" fill="#2f4156" />
					</pattern>
					<linearGradient id="sea-fade" x1="0" x2="0" y1="0" y2="1">
						<stop offset="0" stop-color="#fff" stop-opacity="0" />
						<stop offset=".12" stop-color="#fff" />
						<stop offset=".9" stop-color="#fff" />
						<stop offset="1" stop-color="#fff" stop-opacity="0" />
					</linearGradient>
					<mask id="sea-mask" maskUnits="userSpaceOnUse">
						<rect x="-300" y="-20" width="1100" height={H + 40} fill="url(#sea-fade)" />
					</mask>
					<!-- the chosen wash bleeds out from where it was picked -->
					<mask
						id="bleed"
						maskUnits="userSpaceOnUse"
						x="-400"
						y="-100"
						width="1400"
						height={H + 200}
					>
						{#key bleed.n}
							<circle
								cx={bleed.x}
								cy={bleed.y}
								r="1400"
								fill="#fff"
								class={[bleed.n && 'bleed']}
								style:transform-origin="{bleed.x}px {bleed.y}px"
							/>
						{/key}
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

				<!-- each boundary once; the paper fill, the preview and the wash all reuse it -->
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
							onclick={(e) => pick(t.key, e)}
							role="presentation"
						/>
					{/each}
				</g>
				<g class="washes" aria-hidden="true">
					{#each TALUKAS as t (t.key)}
						<use
							href="#tk-{t.key}"
							class={['preview', t.key === hovered && t.key !== selected && 'on']}
						/>
					{/each}
					<g mask="url(#bleed)">
						<use href="#tk-{selected}" class="wash" filter="url(#wash)" />
						<use href="#tk-{selected}" class="pits" />
					</g>
				</g>
				<path d={TALUKA_GEO.borders} class="borders" pathLength="1" />
				<path d={TALUKA_GEO.outline} class="district" pathLength="1" />

				<g class="names">
					<path d="M196 88 L250 64" class="name-leader" />
					{#each TALUKAS as t (t.key)}
						{@const [x, y, deg] = NAME_AT[t.key]}
						<text
							data-key={t.key}
							{x}
							{y}
							transform={deg ? `rotate(${deg} ${x} ${y})` : undefined}
							text-anchor={t.key === 'mandangad' ? 'start' : 'middle'}
							class={[t.key === shown && 'on']}>{tr(t.name)}</text
						>
					{/each}
				</g>

				<!-- places: leader lines, markers with an ink splash, labels that type in -->
				<g class="places">
					{#each places as p (p.i)}
						<g style:--i={p.i}>
							{#if p.label}
								<path
									d="M{p.x} {p.y} L{p.side === 'w' ? p.tx + 8 : p.tx - 8} {p.ly} L{p.tx} {p.ly}"
									class="leader"
									pathLength="1"
								/>
							{/if}
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
							{#if p.label}
								<text
									x={p.side === 'w' ? p.tx - 6 : p.tx + 6}
									y={p.ly + (narrow ? 11 : 4.5)}
									text-anchor={p.side === 'w' ? 'end' : 'start'}
									class={['label', p.main && 'main']}>{tr(p.name).slice(0, typed)}</text
								>
							{/if}
						</g>
					{/each}
				</g>

				<g transform="translate({narrow ? 560 : 700} 50)" class="north">
					<circle r="26" />
					<path d="M0 -17 L8.5 9 L0 3.4 L-8.5 9 Z" />
					<text y="-36" text-anchor="middle">{MAP.north}</text>
				</g>
			</svg>
			<p class="credit">{tr(MAP.source)}</p>
		</div>

		<!-- the nine talukas as a sheet of stamps; on phones a strip that scrolls sideways -->
		<div class="picker" role="group" aria-label={tr(MAP.pick)} bind:this={strip}>
			{#each TALUKAS as t (t.key)}
				<button
					class="tchip"
					data-key={t.key}
					aria-pressed={t.key === selected}
					onclick={() => pick(t.key)}
					onpointerenter={() => (hovered = t.key)}
					onpointerleave={() => (hovered = null)}
					onfocus={() => (hovered = t.key)}
					onblur={() => (hovered = null)}
				>
					<span class="perf">
						<InkIcon name={t.stamp} size={22} stroke={2.4} />
						<span>{tr(t.name)}</span>
					</span>
				</button>
			{/each}
		</div>

		<!-- the taluka card is a postcard: message on the left, stamp franked by today's postmark on the right -->
		<article class="card" aria-live="polite">
			{#key shown}
				<div class="card-in" out:fly={slide(-28)}>
					<div class="head-row">
						<h3>{tr(tal.name)}</h3>
						<span class="j-deva mr" lang="mr">{tal.name.mr}</span>
					</div>
					<p class="desc">{tr(tal.desc)}</p>
					<ul class="spots">
						{#each tal.spots as s, i (i)}<li>{tr(s)}</li>{/each}
					</ul>
					<a href={resolve('/discover')} class="explore"
						>{tr(MAP.explore).replace('{name}', tr(tal.name))}&nbsp;<span aria-hidden="true">→</span
						></a
					>
				</div>
				<div class="stamp-slot" out:fly={slide(28)}>
					<Stamp
						icon={tal.stamp}
						name={tal.name.en}
						deva={tal.name.mr}
						no={idx}
						caption={tr(MAP.stamp)}
					/>
					{#if pm}
						<svg class="postmark" viewBox="0 0 156 84" aria-hidden="true">
							<defs>
								<path id="pm-top" d="M16 42 A26 26 0 0 1 68 42" />
								<path id="pm-bot" d="M11 42 A31 31 0 0 0 73 42" />
							</defs>
							<circle cx="42" cy="42" r="35" class="ring" />
							<circle cx="42" cy="42" r="22" class="ring thin" />
							<text class="arc"
								><textPath href="#pm-top" startOffset="50%" text-anchor="middle"
									>{tr(DISTRICT.name).toLocaleUpperCase('en-IN')}</textPath
								></text
							>
							<text class="arc"
								><textPath href="#pm-bot" startOffset="50%" text-anchor="middle">{pm.year}</textPath
								></text
							>
							<text x="42" y="44" class="day" text-anchor="middle">{pm.day}</text>
							<text x="42" y="54" class="month" text-anchor="middle"
								>{pm.month.toLocaleUpperCase('en-IN')}</text
							>
							<path
								class="cancel"
								d="M80 28 q7 -5 14 0 t14 0 t14 0 t14 0 t14 0 M80 42 q7 -5 14 0 t14 0 t14 0 t14 0 t14 0 M80 56 q7 -5 14 0 t14 0 t14 0 t14 0 t14 0"
							/>
						</svg>
					{/if}
				</div>
			{/key}
			<div class="address" aria-hidden="true"><span></span><span></span><span></span></div>
		</article>
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
		grid-template-rows: 1fr auto auto auto 1fr;
		grid-template-areas: '. map' 'head map' 'pick map' 'card map' '. map';
		column-gap: 48px;
	}
	.head {
		grid-area: head;
	}
	.map {
		grid-area: map;
	}
	.picker {
		grid-area: pick;
	}
	.card {
		grid-area: card;
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

	/* Stamp chips: a perforated paper face with a thin inner frame. The button itself carries the focus ring and
	   the print shadow, so neither is cut by the perforation mask. */
	.picker {
		margin-top: 28px;
		display: flex;
		flex-wrap: wrap;
		gap: 8px 6px;
	}
	.tchip {
		padding: 0;
		border: 0;
		background: none;
		min-height: 44px;
		filter: drop-shadow(1.5px 2px 0 rgb(31 44 59 / 0.22));
		transition:
			transform 0.25s var(--j-spring),
			filter 0.2s;
	}
	.tchip:nth-child(odd) {
		transform: rotate(-0.8deg);
	}
	.tchip:nth-child(even) {
		transform: rotate(0.9deg);
	}
	.perf {
		--hole: 3px;
		display: flex;
		align-items: center;
		gap: 7px;
		min-height: 46px;
		padding: 8px 16px 8px 12px;
		background: var(--paper);
		box-shadow:
			inset 0 0 0 5px var(--paper),
			inset 0 0 0 6px var(--navy);
		color: var(--navy);
		font-size: 14px;
		font-weight: 600;
		white-space: nowrap;
		-webkit-mask:
			radial-gradient(var(--hole) at 50% 50%, #0000 96%, #000) calc(var(--hole) * -1.5)
				calc(var(--hole) * -1.5) / calc(var(--hole) * 3) calc(var(--hole) * 3) round,
			linear-gradient(#000 0 0) content-box;
		mask:
			radial-gradient(var(--hole) at 50% 50%, #0000 96%, #000) calc(var(--hole) * -1.5)
				calc(var(--hole) * -1.5) / calc(var(--hole) * 3) calc(var(--hole) * 3) round,
			linear-gradient(#000 0 0) content-box;
		transition:
			background 0.2s,
			color 0.2s;
	}
	.tchip:hover .perf {
		background: var(--sky);
		box-shadow:
			inset 0 0 0 5px var(--sky),
			inset 0 0 0 6px var(--navy);
	}
	.tchip[aria-pressed='true'] {
		transform: rotate(-3deg) translateY(-2px);
		filter: drop-shadow(3px 3px 0 var(--ink));
	}
	.tchip[aria-pressed='true'] .perf {
		background: var(--navy);
		color: var(--paper);
		box-shadow:
			inset 0 0 0 5px var(--navy),
			inset 0 0 0 6px var(--paper);
	}
	.tchip:active {
		transform: scale(0.95);
	}

	/* The postcard: 2 px corners, a slight rest tilt, printed shadow, address lines under the stamp. */
	.card {
		position: relative;
		display: grid;
		margin-top: 28px;
		padding: 26px 172px 26px 26px;
		min-height: 248px;
		background: var(--paper);
		border: 1.5px solid var(--navy);
		border-radius: 2px;
		box-shadow: 5px 5px 0 var(--navy);
		transform: rotate(-0.8deg);
	}
	.card-in {
		grid-area: 1 / 1;
	}
	.stamp-slot {
		position: absolute;
		top: 16px;
		right: 16px;
	}
	.address {
		position: absolute;
		right: 22px;
		bottom: 30px;
		width: 116px;
		display: grid;
		gap: 16px;
	}
	.address span {
		height: 1px;
		background: var(--line);
	}
	.postmark {
		position: absolute;
		left: -34px;
		top: 116px;
		width: 156px;
		color: var(--navy);
		opacity: 0.78;
		transform: rotate(-9deg);
		pointer-events: none;
	}
	.postmark .ring {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
	}
	.postmark .ring.thin {
		stroke-width: 1;
	}
	.postmark text {
		fill: currentColor;
	}
	.postmark .arc {
		font: 600 8px var(--j-text);
		letter-spacing: 1.6px;
	}
	.postmark .day {
		font: 17px var(--j-display);
	}
	.postmark .month {
		font: 600 7.5px var(--j-text);
		letter-spacing: 1.4px;
	}
	.postmark .cancel {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
	}
	.head-row {
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
		font-size: 22px;
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
		display: inline-block;
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
	.preview {
		fill: url(#halftone);
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.2s;
	}
	.preview.on {
		opacity: 0.55;
	}
	.wash {
		fill: #9fbfd3;
		pointer-events: none;
	}
	.pits {
		fill: url(#pits);
		opacity: 0.32;
		pointer-events: none;
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
	.name-leader {
		fill: none;
		stroke: var(--teal);
		stroke-width: 1.2;
	}
	.names text {
		font-family: var(--j-display);
		font-size: 30px;
		dominant-baseline: central;
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
	/* phones: labels and names set at ≥ 13 px on screen */
	.narrow .label {
		font-size: 33px;
	}
	.narrow .names text {
		font-size: 33px;
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
		.bleed {
			animation: bleed 0.6s var(--j-ease-out) both;
		}
		.card-in {
			animation: slide-in 0.32s var(--j-ease-out) both;
		}
		.stamp-slot :global(.stamp) {
			animation: thunk 0.38s var(--j-spring) 0.08s both;
		}
		.postmark {
			animation: roll 0.42s var(--j-ease-out) 0.34s both;
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
	@keyframes bleed {
		from {
			transform: scale(0);
		}
	}
	@keyframes slide-in {
		from {
			opacity: 0;
			transform: translateX(28px);
		}
	}
	/* stamps thunk (§2.5): 1.4 → 0.96 → 1, −8° → −5° (the stamp's rest tilt) */
	@keyframes thunk {
		0% {
			opacity: 0;
			transform: scale(1.4) rotate(-12deg);
		}
		65% {
			opacity: 1;
			transform: scale(0.96) rotate(-4deg);
		}
	}
	/* the postmark is rolled on from the left, like a hand canceller */
	@keyframes roll {
		from {
			opacity: 0;
			transform: translateX(-46px) rotate(-60deg);
		}
	}

	@media (max-width: 900px) {
		.grid {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto;
			grid-template-areas: 'head' 'map' 'pick' 'card';
		}
		.map {
			margin-top: 28px;
		}
		.map svg {
			max-height: 70vh;
		}
	}
	@media (max-width: 600px) {
		.talukas {
			padding-top: 96px;
		}
		.map svg {
			max-height: none;
		}
		/* one row of stamps that scrolls sideways, bleeding to the screen edges */
		.picker {
			flex-wrap: nowrap;
			overflow-x: auto;
			scroll-snap-type: x proximity;
			scroll-padding-inline: var(--j-gutter);
			margin-inline: calc(var(--j-gutter) * -1);
			padding: 6px var(--j-gutter) 12px;
			scrollbar-width: none;
			position: relative;
		}
		.picker::-webkit-scrollbar {
			display: none;
		}
		.tchip {
			flex: none;
			scroll-snap-align: start;
		}
		.card {
			margin-top: 16px;
			padding: 150px 22px 24px;
			transform: rotate(-0.6deg);
		}
		.stamp-slot {
			top: 14px;
			right: 14px;
		}
		.postmark {
			left: -120px;
			top: 28px;
		}
		.address {
			display: none;
		}
	}
</style>
