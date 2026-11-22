<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { Spring } from 'svelte/motion';
	import { reducedMotion } from '#lib/motion.ts';
	import { visible } from '../inview.ts';
	import { tr } from '../i18n.ts';
	import { GEMS_COPY } from '../content/landing.ts';
	import {
		GEMS,
		GEM_FILTERS,
		VERDICTS,
		VERDICT_ORDER,
		VERDICT_TONES,
		CATEGORIES
	} from '../content/places.ts';
	import { TALUKAS } from '../content/talukas.ts';
	import GemScene from './GemScene.svelte';
	import InkIcon from './InkIcon.svelte';
	import Edge from './Edge.svelte';

	// "The quiet side of Ratnagiri" (brief §7.4): a physical coverflow. Drag or swipe with inertia and snapping,
	// arrow keys, buttons; side cards turn away in 3D, blur and dim; each card's art has its own parallax.
	// Autoplay every 5 s pauses on hover, focus, when off screen, under reduced motion, or with the pause button.
	const n = GEMS.length;
	const pos = new Spring(0, { stiffness: 0.09, damping: 0.62 });
	const active = $derived(((Math.round(pos.target) % n) + n) % n);
	const gem = $derived(GEMS[active]);
	let filter = $state<(typeof GEM_FILTERS)[number]>('all');
	let paused = $state(false);
	let hold = $state(false);
	let onScreen = $state(false);
	let width = $state(1200);
	const S = $derived(width < 640 ? 190 : width < 1000 ? 250 : 300);

	const wrap = (d: number) => ((((d + n / 2) % n) + n) % n) - n / 2;
	function card(i: number) {
		const d = wrap(i - pos.current);
		const a = Math.abs(d);
		const x = Math.sign(d) * (a <= 1 ? a * S : S + (a - 1) * S * 0.62);
		const scale = 1 - Math.min(a, 3) * 0.15;
		return {
			d,
			style: `transform: translateX(calc(-50% + ${x}px)) scale(${scale}) rotateY(${Math.max(-42, Math.min(42, -d * 18))}deg); z-index: ${20 - Math.round(a * 4)}; opacity: ${a > 2.4 ? 0 : 1}; --shift: ${Math.max(-1, Math.min(1, d)).toFixed(3)}; --blur: ${(Math.min(a, 2) * 1.6).toFixed(2)}px; --dim: ${Math.min(a, 2.4) * 0.2}`
		};
	}

	function go(i: number, clearFilter = true) {
		const cur = pos.target;
		const d = wrap(i - cur);
		pos.target = Math.round(cur + d);
		if (clearFilter) filter = 'all';
	}
	const next = () => go(active + 1);
	const prev = () => go(active - 1);

	function pickFilter(f: (typeof GEM_FILTERS)[number]) {
		filter = f;
		if (f !== 'all')
			go(
				GEMS.findIndex((g) => g.taluka === f),
				false
			);
	}

	// Drag with inertia: velocity at release throws the strip, then it snaps to the nearest card.
	let drag: { x: number; p: number; v: number; t: number; moved: boolean } | null = null;
	function down(e: PointerEvent) {
		if (e.button !== 0) return;
		drag = { x: e.clientX, p: pos.current, v: 0, t: performance.now(), moved: false };
		hold = true;
	}
	function moveDrag(e: PointerEvent) {
		if (!drag) return;
		const dx = e.clientX - drag.x;
		if (Math.abs(dx) > 6 && !drag.moved) {
			drag.moved = true;
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		}
		if (!drag.moved) return;
		const now = performance.now();
		const p = drag.p - dx / S;
		drag.v = (p - pos.current) / Math.max(1, now - drag.t);
		drag.t = now;
		pos.set(p, { instant: true });
	}
	function up() {
		if (!drag) return;
		if (drag.moved) {
			pos.target = Math.round(pos.current + drag.v * 220);
			filter = 'all';
		}
		hold = false;
		setTimeout(() => (drag = null));
	}
	function cardClick(e: MouseEvent, i: number) {
		if (drag?.moved) return e.preventDefault();
		if (i !== active) {
			e.preventDefault();
			go(i);
		}
	}
	function key(e: KeyboardEvent) {
		if (e.key === 'ArrowRight') {
			next();
			e.preventDefault();
		}
		if (e.key === 'ArrowLeft') {
			prev();
			e.preventDefault();
		}
	}

	onMount(() => {
		const tick = setInterval(() => {
			if (
				!paused &&
				!hold &&
				onScreen &&
				!reducedMotion.current &&
				document.visibilityState === 'visible'
			)
				next();
		}, 5000);
		return () => clearInterval(tick);
	});
	const talukaName = (k: string) => tr(TALUKAS.find((t) => t.key === k)!.name);
	const catName = (k: string) => tr(CATEGORIES.find((c) => c.key === k)!.name);
</script>

<svelte:window bind:innerWidth={width} />

<section
	class="gems"
	aria-labelledby="gems-title"
	{@attach (node) => visible(node, (v) => (onScreen = v))}
>
	<Edge kind="wave" color="var(--beige)" />
	<div class="j-wrap">
		<p class="j-caps eyebrow">{tr(GEMS_COPY.eyebrow)}</p>
		<h2 id="gems-title" class="j-h2">{tr(GEMS_COPY.title)}</h2>

		<div class="chips" role="group" aria-label={tr(GEMS_COPY.filter)}>
			{#each GEM_FILTERS as f (f)}
				<button class="j-chip" aria-pressed={filter === f} onclick={() => pickFilter(f)}
					>{f === 'all' ? tr(GEMS_COPY.all) : talukaName(f)}</button
				>
			{/each}
			<a href={resolve('/discover?hidden_gem=1')} class="j-chip view"
				>{tr(GEMS_COPY.viewAll)} <span aria-hidden="true">→</span></a
			>
		</div>
	</div>

	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		class={['stage', hold && 'held']}
		role="region"
		aria-roledescription="carousel"
		aria-label={tr(GEMS_COPY.region)}
		tabindex="0"
		onkeydown={key}
		onpointerdown={down}
		onpointermove={moveDrag}
		onpointerup={up}
		onpointercancel={up}
		onpointerenter={(e) => e.pointerType === 'mouse' && (hold = true)}
		onpointerleave={() => !drag && (hold = false)}
		onfocusin={() => (hold = true)}
		onfocusout={() => (hold = false)}
	>
		{#each GEMS as g, i (g.key)}
			{@const c = card(i)}
			<a
				href={resolve('/discover?hidden_gem=1')}
				class={['card', i === active && 'active']}
				style={c.style}
				aria-current={i === active ? 'true' : undefined}
				aria-label={(i === active ? tr(GEMS_COPY.open) : tr(GEMS_COPY.show)).replace(
					'{name}',
					tr(g.name)
				)}
				tabindex={Math.abs(c.d) < 1.5 ? 0 : -1}
				onclick={(e) => cardClick(e, i)}
				draggable="false"
			>
				<span class="art"><GemScene scene={g.scene} tone={i} /></span>
				<span class="shade"></span>
				<span class="badge"><InkIcon name="gem" size={14} stroke={3} />{tr(GEMS_COPY.badge)}</span>
				<span class="foot">
					<span class="crowd">{tr(g.crowd)}</span>
					<span class="go" aria-hidden="true"><InkIcon name="arrow" size={18} stroke={3.4} /></span>
				</span>
			</a>
		{/each}
	</div>

	<div class="controls j-wrap">
		<div class="buttons">
			<button class="round" onclick={prev} aria-label={tr(GEMS_COPY.prev)}>
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					class="j-ink"
					stroke-width="1.8"
					aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg
				>
			</button>
			<span class="counter" aria-live="polite"
				>{String(active + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</span
			>
			<button class="round dark" onclick={next} aria-label={tr(GEMS_COPY.next)}>
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					class="j-ink"
					stroke-width="1.8"
					aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg
				>
			</button>
			<button
				class="round small"
				onclick={() => (paused = !paused)}
				aria-label={paused ? tr(GEMS_COPY.play) : tr(GEMS_COPY.pause)}
				aria-pressed={paused}
			>
				<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
					{#if paused}<path d="M7 5l12 7-12 7z" />{:else}<path
							d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"
						/>{/if}
				</svg>
			</button>
		</div>
		<div class="caption">
			{#key active}
				<div class="cap-in">
					<p class="j-caps meta">{catName(gem.cat)} · {talukaName(gem.taluka)}</p>
					<h3>{tr(gem.name)}</h3>
					<p class="j-deva mr" lang="mr">{gem.name.mr}</p>
				</div>
			{/key}
			<div class="bar" aria-hidden="true">
				{#each VERDICT_ORDER as v, k (v)}
					<span style:width="{gem.split[k]}%" style:background={VERDICT_TONES[k]}></span>
				{/each}
			</div>
			<p class="votes"><strong>{tr(VERDICTS[gem.verdict])}</strong> · {tr(GEMS_COPY.votes)}</p>
			<p class="sample">{tr(GEMS_COPY.sample)}</p>
		</div>
	</div>
</section>

<style>
	.gems {
		position: relative;
		z-index: 3;
		background: var(--beige);
		padding: 72px 0 96px;
		overflow-x: clip;
	}
	.eyebrow {
		color: var(--muted);
	}
	h2 {
		margin-top: 10px;
	}
	.chips {
		margin-top: 32px;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.view {
		text-decoration: none;
	}
	.stage {
		position: relative;
		height: 500px;
		margin-top: 28px;
		perspective: 1400px;
		touch-action: pan-y;
		user-select: none;
		cursor: grab;
		outline-offset: -6px;
	}
	.stage.held:active {
		cursor: grabbing;
	}
	.card {
		position: absolute;
		left: 50%;
		top: 24px;
		width: 340px;
		height: 440px;
		border-radius: 28px;
		overflow: hidden;
		border: 1.5px solid var(--navy);
		background: var(--sky);
		text-decoration: none;
		color: var(--navy);
		filter: blur(var(--blur));
		box-shadow: 0 14px 30px rgb(47 65 86 / 0.12);
		transition:
			opacity 0.35s,
			box-shadow 0.35s;
		-webkit-user-drag: none;
	}
	.card.active {
		box-shadow:
			6px 6px 0 var(--navy),
			0 30px 60px rgb(47 65 86 / 0.25);
	}
	.art {
		position: absolute;
		inset: -10px -40px;
	}
	.shade {
		position: absolute;
		inset: 0;
		background: var(--navy);
		opacity: var(--dim);
		pointer-events: none;
	}
	.badge {
		position: absolute;
		top: 16px;
		left: 16px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border-radius: 999px;
		background: var(--white);
		font-size: 12px;
		font-weight: 600;
	}
	.foot {
		position: absolute;
		left: 16px;
		right: 16px;
		bottom: 16px;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.crowd {
		padding: 6px 12px;
		border-radius: 999px;
		background: rgb(47 65 86 / 0.88);
		color: var(--beige);
		font-size: 12px;
		font-weight: 500;
	}
	.go {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 999px;
		background: var(--white);
		opacity: 0;
		transform: scale(0.6);
		transition:
			opacity 0.3s,
			transform 0.4s var(--j-spring);
	}
	.active .go {
		opacity: 1;
		transform: none;
	}
	.active:hover .go {
		transform: rotate(45deg);
	}
	.controls {
		margin-top: 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
	}
	.buttons {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.round {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border: 1.5px solid var(--navy);
		border-radius: 999px;
		background: transparent;
	}
	.round.dark {
		background: var(--navy);
		color: var(--white);
	}
	.round.small {
		width: 44px;
		height: 44px;
		margin-left: 8px;
		border-style: dashed;
	}
	.counter {
		min-width: 72px;
		text-align: center;
		font-family: var(--j-display);
		font-size: 20px;
	}
	.caption {
		display: grid;
		justify-items: center;
		width: min(380px, 100%);
		text-align: center;
	}
	.meta {
		color: var(--muted);
		letter-spacing: 0.2em;
	}
	h3 {
		margin-top: 6px;
		font-family: var(--j-display);
		font-weight: 400;
		font-size: 36px;
		line-height: 1.1;
	}
	.mr {
		font-size: 19px;
		color: var(--muted);
	}
	.bar {
		margin-top: 14px;
		display: flex;
		gap: 2px;
		width: 100%;
		height: 8px;
		border-radius: 999px;
		overflow: hidden;
	}
	.bar span {
		transition: width 0.7s var(--j-spring);
	}
	.votes {
		margin-top: 8px;
		font-size: 14px;
		color: var(--muted);
	}
	.votes strong {
		color: var(--navy);
	}
	.sample {
		font-size: 11px;
		color: var(--muted);
		opacity: 0.8;
	}
	@media (prefers-reduced-motion: no-preference) {
		.cap-in {
			animation: cap 0.45s var(--j-ease-out) both;
		}
	}
	@keyframes cap {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
	}
	@media (max-width: 640px) {
		.stage {
			height: 420px;
		}
		.card {
			width: 250px;
			height: 360px;
		}
	}
</style>
