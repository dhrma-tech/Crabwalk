<script lang="ts">
	import { resolve } from '$app/paths';
	import { inview } from '../inview.ts';
	import { tr } from '../i18n.ts';
	import { CLOSING } from '../content/landing.ts';
	import Crabby, { type CrabbyState } from '#lib/components/Crabby.svelte';
	import Edge from './Edge.svelte';

	// Closing CTA + footer (brief §7.9): कोकण filled with slowly rising, swaying water (an SVG clip of the word);
	// the footer's top edge is a rippling tide line, and Crabby sits on it and waves goodbye when it comes into view.
	let crab = $state<CrabbyState>('idle');
	let installHint = $state(false);
	function bye() {
		crab = 'wave';
		setTimeout(() => (crab = 'idle'), 2200);
	}
	const wave = (y: number) => {
		let d = `M-400 ${y}`;
		for (let x = -400; x < 1800; x += 200) d += ` q50 -18 100 0 t100 0`;
		return d + ' V400 H-400 Z';
	};
</script>

<section class="closing" aria-labelledby="closing-title">
	<Edge kind="wave" color="var(--navy)" height={56} />
	<div class="mark" aria-hidden="true">
		<svg viewBox="0 0 1000 330">
			<defs>
				<clipPath id="konkan-clip">
					<text x="500" y="250" text-anchor="middle" class="kword">{CLOSING.watermark}</text>
				</clipPath>
			</defs>
			<text x="500" y="250" text-anchor="middle" class="kword ghost">{CLOSING.watermark}</text>
			<g clip-path="url(#konkan-clip)">
				<g class="water">
					<path class="w-back" d={wave(150)} fill="#436475" />
					<path class="w-front" d={wave(170)} fill="#567c8d" />
				</g>
			</g>
		</svg>
	</div>
	<div class="cta j-wrap">
		<h2 id="closing-title" class="j-display">{tr(CLOSING.title)}</h2>
		<p class="j-lead">{tr(CLOSING.body)}</p>
		<div class="btns">
			<a href={resolve('/plan/new')} class="j-btn paper">{tr(CLOSING.plan)}</a>
			<button
				class="j-btn on-dark"
				onclick={() => (installHint = !installHint)}
				aria-expanded={installHint}>{tr(CLOSING.install)}</button
			>
		</div>
		{#if installHint}<p class="hint" role="status">{tr(CLOSING.installHow)}</p>{/if}
	</div>

	<footer class="foot" use:inview={{ onenter: bye, margin: '0px 0px -20% 0px' }}>
		<div class="tideline" aria-hidden="true">
			<svg viewBox="0 0 1440 40" preserveAspectRatio="none">
				<path
					class="tide"
					d="M-120 20 Q -90 10 -60 20 T 0 20 T 60 20 T 120 20 T 180 20 T 240 20 T 300 20 T 360 20 T 420 20 T 480 20 T 540 20 T 600 20 T 660 20 T 720 20 T 780 20 T 840 20 T 900 20 T 960 20 T 1020 20 T 1080 20 T 1140 20 T 1200 20 T 1260 20 T 1320 20 T 1380 20 T 1440 20 T 1500 20 T 1560 20"
					fill="none"
					stroke="#567c8d"
					stroke-width="2"
					vector-effect="non-scaling-stroke"
				/>
				<path
					class="tide t2"
					d="M-120 28 Q -90 20 -60 28 T 0 28 T 60 28 T 120 28 T 180 28 T 240 28 T 300 28 T 360 28 T 420 28 T 480 28 T 540 28 T 600 28 T 660 28 T 720 28 T 780 28 T 840 28 T 900 28 T 960 28 T 1020 28 T 1080 28 T 1140 28 T 1200 28 T 1260 28 T 1320 28 T 1380 28 T 1440 28 T 1500 28 T 1560 28"
					fill="none"
					stroke="#436475"
					stroke-width="1.5"
					vector-effect="non-scaling-stroke"
				/>
			</svg>
			<span class="sitter"><Crabby size={86} state={crab} /></span>
		</div>
		<div class="j-wrap fgrid">
			<div class="brand">
				<p class="word">Crabwalk</p>
				<p class="tag">{tr(CLOSING.tagline)}</p>
			</div>
			<nav aria-label={tr(CLOSING.footer)} class="cols">
				{#each CLOSING.cols as c (c.title.en)}
					<div>
						<p class="j-caps h">{tr(c.title)}</p>
						{#each c.links as l (l.label.en)}
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- static app paths -->
							<a href={l.href}>{tr(l.label)}</a>
						{/each}
					</div>
				{/each}
			</nav>
		</div>
		<div class="j-wrap legal">
			<p>{tr(CLOSING.copyright)}</p>
			<p>
				<a href={resolve('/privacy')}>{tr(CLOSING.privacy)}</a> ·
				<a href={resolve('/terms')}>{tr(CLOSING.terms)}</a>
			</p>
		</div>
	</footer>
</section>

<style>
	.closing {
		position: relative;
		z-index: 8;
		background: var(--navy);
		color: var(--beige);
		padding: 72px 0 32px;
		overflow-x: clip;
	}
	.mark {
		position: relative;
		width: min(1000px, 100%);
		margin: 0 auto;
		padding: 0 var(--j-gutter);
	}
	.mark svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}
	.kword {
		font-family: var(--j-deva);
		font-size: 300px;
	}
	.ghost {
		fill: #374b61;
	}
	.cta {
		position: relative;
		margin-top: -60px;
		max-width: 900px;
		text-align: center;
	}
	h2 {
		font-size: clamp(44px, 6.4vw, 88px);
	}
	.cta .j-lead {
		margin: 20px auto 0;
		max-width: 520px;
		color: var(--sky);
	}
	.btns {
		margin-top: 32px;
		display: flex;
		gap: 12px;
		justify-content: center;
		flex-wrap: wrap;
	}
	.hint {
		margin-top: 12px;
		font-size: 14px;
		color: var(--sky);
	}
	.foot {
		position: relative;
		margin-top: 120px;
		padding-top: 48px;
	}
	.tideline {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		height: 40px;
	}
	.tideline svg {
		width: 100%;
		height: 100%;
		display: block;
	}
	.sitter {
		position: absolute;
		left: 12%;
		top: -62px;
	}
	.fgrid {
		display: flex;
		flex-wrap: wrap;
		gap: 40px;
		justify-content: space-between;
	}
	.word {
		font-family: var(--j-display);
		font-size: 30px;
	}
	.tag {
		margin-top: 10px;
		max-width: 300px;
		font-size: 14px;
		color: var(--sky);
	}
	.cols {
		display: flex;
		flex-wrap: wrap;
		gap: 48px;
		font-size: 14px;
	}
	.cols div {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.h {
		margin-bottom: 6px;
		color: var(--sky);
		letter-spacing: 0.2em;
	}
	.cols a {
		display: inline-flex;
		align-items: center;
		min-height: 32px;
		text-decoration: none;
	}
	.cols a:hover {
		text-decoration: underline;
		text-underline-offset: 4px;
	}
	.legal {
		margin-top: 40px;
		display: flex;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		font-size: 12px;
		color: var(--sky);
	}
	@media (prefers-reduced-motion: no-preference) {
		.water {
			animation: rise 9s ease-in-out infinite alternate;
		}
		.w-back {
			animation: sway 7s linear infinite;
		}
		.w-front {
			animation: sway 5s linear infinite reverse;
		}
		.tide {
			animation: tide 7s linear infinite;
		}
		.t2 {
			animation-duration: 10s;
			animation-direction: reverse;
		}
	}
	@keyframes rise {
		from {
			transform: translateY(70px);
		}
		to {
			transform: translateY(-20px);
		}
	}
	@keyframes sway {
		to {
			transform: translateX(200px);
		}
	}
	@keyframes tide {
		to {
			transform: translateX(120px);
		}
	}
	@media (max-width: 640px) {
		.sitter {
			left: auto;
			right: 16px;
		}
		.cta {
			margin-top: -20px;
		}
	}
</style>
