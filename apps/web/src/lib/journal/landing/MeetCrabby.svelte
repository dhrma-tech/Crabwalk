<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { reducedMotion } from '#lib/motion.ts';
	import { inview } from '../inview.ts';
	import { tr } from '../i18n.ts';
	import { CRABBY } from '../content/landing.ts';
	import Crabby, { type CrabbyState } from '#lib/components/Crabby.svelte';
	import InkIcon from './InkIcon.svelte';
	import Edge from './Edge.svelte';

	// "Meet Crabby" (brief §7.6), the signature moment: Crabby scuttles in sideways from off screen, stops centre
	// stage, looks at the viewer and waves. Then the sample questions float up one by one and type themselves in
	// their own script. Clicking one makes Crabby point at it.
	// Server render (and no JS): everything in place. After hydration, motion arms it off stage.
	let phase = $state<'away' | 'walking' | 'here'>('here');
	let crab = $state<CrabbyState>('idle');
	let flip = $state(false);
	let greet = $state(true);
	let armed = false;

	const seg = (s: string, lang: string) =>
		typeof Intl !== 'undefined' && 'Segmenter' in Intl
			? [...new Intl.Segmenter(lang, { granularity: 'grapheme' }).segment(s)].map((x) => x.segment)
			: [...s];
	const GRAPHEMES = CRABBY.questions.map((q) => seg(q.text, q.lang));
	let typed = $state<number[]>(GRAPHEMES.map((g) => g.length));
	onMount(() => {
		if (reducedMotion.current) return;
		armed = true;
		phase = 'away';
		greet = false;
		typed = GRAPHEMES.map(() => 0);
	});
	// Desktop positions around the stage (left/right side, top offset in px); phones stack them.
	const SPOTS = [
		{ side: 'l', top: 40, rot: -3 },
		{ side: 'l', top: 250, rot: 2 },
		{ side: 'r', top: 120, rot: 3 },
		{ side: 'r', top: 320, rot: -2 }
	];

	function enter() {
		if (!armed) return;
		phase = 'walking';
		crab = 'scuttle';
		setTimeout(() => {
			phase = 'here';
			crab = 'wave';
			greet = true;
			setTimeout(() => (crab = 'idle'), 1900);
			typeAll();
		}, 1900);
	}
	function typeAll() {
		GRAPHEMES.forEach((g, i) => {
			const start = 300 + i * 550;
			for (let k = 1; k <= g.length; k++) setTimeout(() => (typed[i] = k), start + k * 32);
		});
	}
	function ask(i: number) {
		flip = SPOTS[i].side === 'l';
		crab = 'point';
		setTimeout(() => (crab = 'idle'), 2400);
	}
</script>

<section class="meet" id="crabby" aria-labelledby="meet-title">
	<Edge kind="wave" color="var(--sky)" />
	<div class="j-wrap">
		<div class="head">
			<span class="badge j-caps">{tr(CRABBY.eyebrow)}</span>
			<h2 id="meet-title" class="j-display">{tr(CRABBY.title)}</h2>
			<p class="j-lead">{tr(CRABBY.body)}</p>
		</div>

		<div class="stage" use:inview={{ onenter: enter, margin: '0px 0px -30% 0px' }}>
			<div class={['crab', phase]}>
				{#if greet}
					<div class="greet">
						<p class="j-deva" lang="mr">{CRABBY.hello}</p>
						<p>{tr(CRABBY.im)}</p>
					</div>
				{/if}
				<Crabby size={300} state={crab} {flip} label={tr(CRABBY.stageLabel)} />
			</div>
			<ul class="qs">
				{#each CRABBY.questions as q, i (i)}
					<li
						class={['q', `s-${SPOTS[i].side}`, typed[i] > 0 && 'shown', q.voice && 'voice']}
						style:--top="{SPOTS[i].top}px"
						style:--rot="{SPOTS[i].rot}deg"
					>
						<button onclick={() => ask(i)} lang={q.lang} class={[q.lang !== 'en' && 'j-deva']}>
							{#if q.voice}<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									class="j-ink"
									stroke-width="1.8"
									aria-hidden="true"
									><rect x="9" y="3" width="6" height="11" rx="3" /><path
										d="M5 11a7 7 0 0014 0M12 18v3"
									/></svg
								><span class="sr-only">{tr(CRABBY.voice)}:</span>{/if}
							<span class="sr-only">{q.text}</span>
							<span aria-hidden="true"
								>{GRAPHEMES[i].slice(0, typed[i]).join('')}<span class="ghost"
									>{GRAPHEMES[i].slice(typed[i]).join('')}</span
								></span
							>
						</button>
					</li>
				{/each}
			</ul>
		</div>

		<div class="points">
			{#each CRABBY.points as p, i (i)}
				<article class="point">
					<span class="ptile"><InkIcon name={p.icon} size={28} stroke={2.4} hover /></span>
					<div>
						<h3>{tr(p.title)}</h3>
						<p>{tr(p.desc)}</p>
					</div>
				</article>
			{/each}
		</div>

		<div class="ctas">
			<a href={resolve('/crabby')} class="j-btn">{tr(CRABBY.chat)}</a>
			<a href="#plan" class="j-btn paper">{tr(CRABBY.how)} <span aria-hidden="true">↓</span></a>
		</div>
	</div>
</section>

<style>
	.meet {
		position: relative;
		z-index: 5;
		background: var(--sky);
		padding: 88px 0 112px;
		overflow-x: clip;
	}
	.head {
		max-width: 760px;
		margin: 0 auto;
		text-align: center;
	}
	.badge {
		display: inline-block;
		padding: 6px 14px;
		border-radius: 999px;
		background: var(--white);
		letter-spacing: 0.2em;
	}
	h2 {
		margin-top: 18px;
		font-size: clamp(44px, 6.4vw, 92px);
	}
	.head .j-lead {
		margin: 20px auto 0;
		max-width: 540px;
	}
	.stage {
		position: relative;
		height: 480px;
		max-width: 1080px;
		margin: 24px auto 0;
	}
	.crab {
		position: absolute;
		left: 50%;
		top: 70px;
		translate: -50% 0;
		transition: transform 1.9s cubic-bezier(0.3, 0.1, 0.25, 1);
	}
	.crab.away {
		transform: translateX(-75vw);
	}
	.crab.walking,
	.crab.here {
		transform: none;
	}
	.greet {
		position: absolute;
		left: 58%;
		top: -36px;
		z-index: 2;
		padding: 12px 18px;
		border-radius: 22px 22px 22px 6px;
		background: var(--navy);
		color: var(--beige);
		box-shadow: 4px 4px 0 var(--laterite);
		white-space: nowrap;
		animation: pop 0.5s var(--j-spring) both;
	}
	.greet .j-deva {
		font-size: 20px;
		line-height: 1.3;
	}
	.greet p + p {
		font-size: 14px;
		font-weight: 600;
	}
	.qs {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.q {
		position: absolute;
		top: var(--top);
		opacity: 0;
		transform: translateY(18px) rotate(var(--rot));
		transition:
			opacity 0.5s,
			transform 0.7s var(--j-spring);
	}
	.q.shown {
		opacity: 1;
		transform: rotate(var(--rot));
	}
	.s-l {
		left: 0;
	}
	.s-r {
		right: 0;
	}
	.q button {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 48px;
		max-width: 340px;
		padding: 12px 18px;
		border: 1.5px solid var(--navy);
		border-radius: 999px;
		background: var(--white);
		font-size: 15px;
		text-align: left;
		box-shadow: 3px 3px 0 var(--navy);
		transition:
			transform 0.2s var(--j-ease),
			box-shadow 0.2s;
	}
	.q button.j-deva {
		font-size: 17px;
	}
	.q button:hover {
		transform: translate(-1px, -2px);
		box-shadow: 4px 5px 0 var(--navy);
	}
	.voice button {
		background: var(--navy);
		color: var(--beige);
		box-shadow: 3px 3px 0 var(--laterite);
	}
	.ghost {
		visibility: hidden;
	}
	.points {
		margin-top: 32px;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
		gap: 16px;
	}
	.point {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 26px;
		border-radius: 24px;
		background: var(--white);
		border: 1.5px solid transparent;
		transition: border-color 0.25s;
	}
	.point:hover {
		border-color: var(--navy);
	}
	.ptile {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 52px;
		height: 52px;
		border-radius: 16px;
		background: var(--beige);
	}
	.point h3 {
		font-family: var(--j-display);
		font-weight: 400;
		font-size: 24px;
		line-height: 1.15;
	}
	.point p {
		margin-top: 8px;
		font-size: 15px;
		color: var(--muted);
	}
	.ctas {
		margin-top: 40px;
		display: flex;
		justify-content: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: scale(0.6) translateY(10px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.crab.away {
			transform: none;
		}
	}
	@media (max-width: 860px) {
		.stage {
			height: auto;
			display: grid;
			justify-items: center;
			gap: 12px;
			padding-top: 56px;
		}
		.crab {
			position: relative;
			left: auto;
			top: auto;
			translate: none;
		}
		.crab :global(svg) {
			width: 220px;
			height: 220px;
		}
		.greet {
			left: 52%;
			top: -44px;
		}
		.qs {
			display: grid;
			gap: 10px;
			justify-items: center;
		}
		.q {
			position: static;
		}
	}
</style>
