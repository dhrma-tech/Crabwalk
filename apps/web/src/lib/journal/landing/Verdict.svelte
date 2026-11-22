<script lang="ts">
	import { resolve } from '$app/paths';
	import { Spring } from 'svelte/motion';
	import { tr } from '../i18n.ts';
	import { VERDICT } from '../content/landing.ts';
	import { VERDICTS, VERDICT_ORDER, VERDICT_TONES } from '../content/places.ts';
	import Avatar from './Avatar.svelte';
	import Edge from './Edge.svelte';

	// "The verdict" (brief §7.8): nine columns of illustrated travellers loop vertically, alternating up and down
	// at slightly different speeds under a top fade; hover, focus or the pause button stops them. The gauge's
	// segments spring to each group's split. The split is the reference's illustrative sample: the bar shows it,
	// the words stay [%] / [n] until real votes exist (brief §4: never invent statistics).
	const person = (
		bg: string,
		skin: string,
		style: 'short' | 'long' | 'bun' | 'cap' | 'bald',
		hair: string,
		shirt: string,
		chip = -1,
		extra: 'glasses' | 'bindi' | 'beard' | null = null
	) => ({ bg, skin, style, hair, shirt, chip, extra });
	const WALL: { offset: number; tiles: ReturnType<typeof person>[] }[] = [
		{
			offset: 70,
			tiles: [
				person('#dde7ee', '#c68642', 'short', '#1e1612', '#567c8d'),
				person('#f5efeb', '#8d5524', 'long', '#1e1612', '#2f4156', 0, 'bindi')
			]
		},
		{
			offset: 10,
			tiles: [
				person('#c8d9e6', '#e0ac69', 'bun', '#3b2a20', '#ffffff'),
				person('#e9e2dc', '#6b4226', 'short', '#1e1612', '#8aa7b9', -1, 'beard')
			]
		},
		{
			offset: 120,
			tiles: [
				person('#f5efeb', '#b07a4f', 'bald', '#1e1612', '#436475', 1, 'glasses'),
				person('#a9c2d4', '#c68642', 'long', '#2b1d16', '#f5efeb')
			]
		},
		{
			offset: 40,
			tiles: [
				person('#c8d9e6', '#8d5524', 'cap', '#2f4156', '#ffffff'),
				person('#dde7ee', '#e0ac69', 'short', '#5a4a42', '#2f4156')
			]
		},
		{
			offset: 0,
			tiles: [
				person('#e9e2dc', '#a86b4a', 'long', '#1e1612', '#567c8d', 2),
				person('#c8d9e6', '#6b4226', 'short', '#1e1612', '#f5efeb', -1, 'glasses')
			]
		},
		{
			offset: 90,
			tiles: [
				person('#f5efeb', '#c68642', 'bun', '#1e1612', '#2f4156', -1, 'bindi'),
				person('#a9c2d4', '#b07a4f', 'short', '#2b1d16', '#ffffff', 3)
			]
		},
		{
			offset: 30,
			tiles: [
				person('#dde7ee', '#8d5524', 'short', '#1e1612', '#436475', -1, 'beard'),
				person('#e9e2dc', '#e0ac69', 'long', '#3b2a20', '#8aa7b9')
			]
		},
		{
			offset: 110,
			tiles: [
				person('#c8d9e6', '#6b4226', 'bald', '#1e1612', '#f5efeb'),
				person('#f5efeb', '#c68642', 'cap', '#b5462b', '#2f4156')
			]
		},
		{
			offset: 50,
			tiles: [
				person('#f5efeb', '#a86b4a', 'cap', '#567c8d', '#2f4156', 4),
				person('#dde7ee', '#c68642', 'long', '#1e1612', '#ffffff')
			]
		}
	];

	let group = $state<(typeof VERDICT.groups)[number]['key']>('family');
	let paused = $state(false);
	const segs = VERDICT_ORDER.map(
		(_, k) => new Spring(VERDICT.dists.family[k], { stiffness: 0.12, damping: 0.38 })
	);
	function pick(g: typeof group) {
		group = g;
		VERDICT.dists[g].forEach((v, k) => (segs[k].target = v));
	}
	const groupLabel = $derived(
		tr(VERDICT.groups.find((g) => g.key === group)!.label).toLocaleLowerCase('en-IN')
	);
</script>

<section class="verdict" aria-labelledby="verdict-title">
	<Edge kind="scallop" color="#ffffff" height={30} />
	<div class={['wall', paused && 'paused']} role="img" aria-label={tr(VERDICT.wall)}>
		<div class="cols">
			{#each WALL as col, c (c)}
				<div
					class="col"
					style:--off="{col.offset}px"
					style:--dur="{34 + (c % 4) * 7}s"
					class:up={c % 2 === 0}
				>
					<div class="track">
						{#each [0, 1, 2, 3] as rep (rep)}
							{#each col.tiles as p, t (t)}
								<figure class="tile">
									<Avatar
										bg={p.bg}
										skin={p.skin}
										style={p.style}
										hair={p.hair}
										shirt={p.shirt}
										extra={p.extra}
									/>
									{#if p.chip >= 0}<figcaption>{tr(VERDICT.chips[p.chip])}</figcaption>{/if}
								</figure>
							{/each}
						{/each}
					</div>
				</div>
			{/each}
		</div>
		<div class="featured">
			<figure class="big">
				<Avatar
					bg="#c8d9e6"
					skin="#b07a4f"
					style="long"
					hair="#2b1d16"
					shirt="#2f4156"
					extra="bindi"
				/>
			</figure>
			<div class="fcard">
				<p class="fv">{tr(VERDICTS.must)}</p>
				<p class="fm">{tr(VERDICT.featured)}</p>
			</div>
		</div>
	</div>
	<button
		class="wallctl"
		onclick={() => (paused = !paused)}
		aria-pressed={paused}
		aria-label={paused ? tr(VERDICT.play) : tr(VERDICT.pause)}
	>
		<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
			{#if paused}<path d="M7 5l12 7-12 7z" />{:else}<path
					d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"
				/>{/if}
		</svg>
	</button>

	<div class="copy j-wrap">
		<span class="badge j-caps">{tr(VERDICT.eyebrow)}</span>
		<h2 id="verdict-title" class="j-h2">
			{tr(VERDICT.title1)}<br /><span class="soft">{tr(VERDICT.title2)}</span>
		</h2>
		<p class="j-lead body">{tr(VERDICT.body)}</p>

		<div class="gauge">
			<div class="ghead">
				<div>
					<p class="j-caps meta">{tr(VERDICT.placeMeta)}</p>
					<p class="place">{tr(VERDICT.place)}</p>
				</div>
				<div class="tabs" role="tablist" aria-label={tr(VERDICT.who)}>
					{#each VERDICT.groups as g (g.key)}
						<button role="tab" aria-selected={group === g.key} onclick={() => pick(g.key)}
							>{tr(g.label)}</button
						>
					{/each}
				</div>
			</div>
			<p class="big-v">
				{tr(VERDICTS.must)}
				<span>{tr(VERDICT.of).replace('{group}', groupLabel)}</span>
			</p>
			<div class="bar" aria-hidden="true">
				{#each VERDICT_ORDER as v, k (v)}
					<span style:width="{segs[k].current}%" style:background={VERDICT_TONES[k]}></span>
				{/each}
			</div>
			<div class="legend">
				{#each VERDICT_ORDER as v, k (v)}
					<span><i style:background={VERDICT_TONES[k]}></i>{tr(VERDICTS[v])}</span>
				{/each}
			</div>
		</div>
		<a href={resolve('/discover')} class="j-btn read"
			>{tr(VERDICT.read)} <span aria-hidden="true">→</span></a
		>
	</div>
</section>

<style>
	.verdict {
		position: relative;
		z-index: 7;
		background: var(--white);
		padding: 56px 0 128px;
		overflow-x: clip;
	}
	.wall {
		position: relative;
		height: 440px;
		max-width: 1360px;
		margin: 0 auto;
		overflow: hidden;
		-webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 34%, #000 86%, transparent);
		mask-image: linear-gradient(to bottom, transparent 0, #000 34%, #000 86%, transparent);
	}
	.cols {
		position: absolute;
		inset: 0;
		display: flex;
		justify-content: center;
		gap: 22px;
	}
	.col {
		position: relative;
		flex: none;
		width: 112px;
		padding-top: var(--off);
	}
	.col::before {
		content: '';
		position: absolute;
		left: 50%;
		top: 0;
		bottom: 0;
		border-left: 1px dashed var(--line-2);
	}
	.track {
		display: flex;
		flex-direction: column;
		gap: 22px;
	}
	.tile {
		position: relative;
		width: 112px;
		height: 132px;
		border-radius: 18px;
		overflow: hidden;
		border: 1.5px solid var(--navy);
	}
	figcaption {
		position: absolute;
		left: 8px;
		right: 8px;
		bottom: 8px;
		padding: 4px 8px;
		border-radius: 999px;
		background: var(--white);
		border: 1px solid var(--navy);
		font-size: 11px;
		font-weight: 600;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.featured {
		position: absolute;
		right: 7%;
		top: 180px;
		z-index: 3;
		transform: rotate(4deg);
	}
	.big {
		width: 168px;
		height: 200px;
		border-radius: 24px;
		overflow: hidden;
		border: 2px solid var(--navy);
		box-shadow: 8px 8px 0 var(--navy);
	}
	.fcard {
		position: absolute;
		left: -96px;
		bottom: -26px;
		width: 200px;
		padding: 12px 14px;
		border-radius: 16px;
		background: var(--white);
		border: 1.5px solid var(--navy);
		box-shadow: 4px 4px 0 var(--laterite);
		transform: rotate(-6deg);
	}
	.fv {
		font-family: var(--j-display);
		font-size: 22px;
	}
	.fm {
		font-size: 12px;
		color: var(--muted);
	}
	.wallctl {
		position: absolute;
		top: 72px;
		right: max(16px, calc((100% - 1360px) / 2 + 16px));
		z-index: 4;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 999px;
		border: 1.5px dashed var(--navy);
		background: var(--white);
	}
	@media (prefers-reduced-motion: no-preference) {
		.col .track {
			animation: loop-down var(--dur) linear infinite;
		}
		.col.up .track {
			animation-name: loop-up;
		}
		.wall:hover .track,
		.wall:focus-within .track,
		.paused .track {
			animation-play-state: paused;
		}
		:global(html[data-lite]) .track {
			animation: none;
		}
	}
	/* Four identical repeats: moving by a quarter of the track loops seamlessly. */
	@keyframes loop-up {
		to {
			transform: translateY(-25%);
		}
	}
	@keyframes loop-down {
		from {
			transform: translateY(-25%);
		}
		to {
			transform: translateY(0);
		}
	}
	.copy {
		position: relative;
		max-width: 760px;
		margin-top: 8px;
		text-align: center;
	}
	.badge {
		display: inline-block;
		padding: 6px 14px;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--beige);
		letter-spacing: 0.2em;
	}
	h2 {
		margin-top: 18px;
	}
	.soft {
		color: var(--teal);
	}
	.body {
		margin: 20px auto 0;
		max-width: 520px;
		color: var(--muted);
	}
	.gauge {
		margin: 36px auto 0;
		max-width: 640px;
		padding: 28px;
		border-radius: 28px;
		background: var(--white);
		border: 1.5px solid var(--navy);
		box-shadow: 6px 6px 0 var(--navy);
		text-align: left;
	}
	.ghead {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
	}
	.meta {
		color: var(--muted);
		letter-spacing: 0.2em;
	}
	.place {
		margin-top: 4px;
		font-family: var(--j-display);
		font-size: 26px;
	}
	.tabs {
		display: flex;
		gap: 4px;
		padding: 4px;
		border-radius: 999px;
		background: var(--beige);
		flex-wrap: wrap;
	}
	.tabs button {
		min-height: 40px;
		padding: 0 14px;
		border: 0;
		border-radius: 999px;
		background: transparent;
		font-size: 13px;
		font-weight: 600;
		transition:
			background 0.2s,
			color 0.2s;
	}
	.tabs button[aria-selected='true'] {
		background: var(--navy);
		color: var(--white);
	}
	.big-v {
		margin-top: 24px;
		font-family: var(--j-display);
		font-size: 40px;
		line-height: 1.1;
	}
	.big-v span {
		font-family: var(--j-text);
		font-size: 16px;
		color: var(--muted);
	}
	.bar {
		margin-top: 18px;
		display: flex;
		gap: 3px;
		height: 16px;
		border-radius: 999px;
		overflow: hidden;
	}
	.legend {
		margin-top: 12px;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 8px;
		font-size: 13px;
		color: var(--muted);
	}
	.legend span {
		display: flex;
		gap: 6px;
		align-items: center;
	}
	.legend i {
		flex: none;
		width: 10px;
		height: 10px;
		border-radius: 3px;
	}
	.read {
		margin-top: 32px;
	}
	@media (max-width: 720px) {
		.featured {
			display: none;
		}
		.legend {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.big-v {
			font-size: 32px;
		}
	}
</style>
