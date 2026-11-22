<script lang="ts">
	import { resolve } from '$app/paths';
	import { inview } from '../inview.ts';
	import { tr } from '../i18n.ts';
	import { CATS } from '../content/landing.ts';
	import { CATEGORIES, type CategoryKey } from '../content/places.ts';
	import InkIcon from './InkIcon.svelte';
	import Edge from './Edge.svelte';
	import Crabby from '#lib/components/Crabby.svelte';

	// "Eleven ways into the coast" (brief §7.3): an editorial index, not an icon grid. Ink icons draw themselves
	// when the list comes into view and again on hover. With a mouse, a small preview floats by the pointer: the
	// category photo in duotone (full colour on hover) and the verified-places count (placeholder until live).
	let seen = $state(false);
	let hover = $state<CategoryKey | null>(null);
	let px = $state(0);
	let py = $state(0);
	let list = $state<HTMLElement>();
	const cat = $derived(CATEGORIES.find((c) => c.key === hover));

	function move(e: PointerEvent, key: CategoryKey) {
		if (e.pointerType !== 'mouse' || !list) return;
		const r = list.getBoundingClientRect();
		px = e.clientX - r.left;
		py = e.clientY - r.top;
		hover = key;
	}
</script>

<section class="cats" id="discover" aria-labelledby="cats-title">
	<Edge kind="torn" color="#ffffff" />
	<div class="j-wrap">
		<div class="head">
			<div>
				<p class="j-caps eyebrow">{tr(CATS.eyebrow)}</p>
				<h2 id="cats-title" class="j-h2">{tr(CATS.title)}</h2>
			</div>
			<p class="body">{tr(CATS.body)}</p>
		</div>

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="wrap"
			bind:this={list}
			use:inview={{ onenter: () => (seen = true) }}
			onpointerleave={() => (hover = null)}
		>
			<ol class="index">
				{#each CATEGORIES as c, i (c.key)}
					<li>
						<a
							href={resolve(`/discover?category=${c.key}`)}
							onpointermove={(e) => move(e, c.key)}
							onfocus={() => (hover = null)}
							aria-label="{tr(c.name)}, {tr(c.line)}"
						>
							<span class="no">{String(i + 1).padStart(2, '0')}</span>
							<span class="icon"
								><InkIcon name={c.key} size={44} draw={seen} hover delay={i * 70} /></span
							>
							<span class="name">{tr(c.name)}</span>
							<span class="line">{tr(c.line)}</span>
							<span class="arrow" aria-hidden="true">→</span>
						</a>
					</li>
				{/each}
				<li class="note">
					<Crabby size={92} state="point" flip follow={false} />
					<span>{tr(CATS.body)}</span>
				</li>
			</ol>
			{#if cat}
				<div class="preview" style:translate="{px + 28}px {py - 110}px" aria-hidden="true">
					<img
						src="/categories/{cat.key}.webp"
						alt=""
						class="j-duotone"
						width="220"
						height="150"
						loading="lazy"
						decoding="async"
					/>
					<span class="pname">{tr(cat.name)}</span>
					<span class="count">{tr(CATS.count)}</span>
				</div>
			{/if}
		</div>
	</div>
</section>

<style>
	.cats {
		position: relative;
		z-index: 2;
		background: var(--white);
		padding: 72px 0 96px;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 24px;
		flex-wrap: wrap;
	}
	.eyebrow {
		color: var(--muted);
	}
	h2 {
		margin-top: 10px;
		max-width: 11ch;
	}
	.body {
		max-width: 380px;
		color: var(--muted);
	}
	@media (min-width: 901px) {
		.body {
			display: none;
		}
	}
	@media (max-width: 900px) {
		.note {
			display: none !important;
		}
	}
	.wrap {
		position: relative;
		margin-top: 48px;
	}
	.index {
		padding: 0;
		list-style: none;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		column-gap: 48px;
		border-top: 1.5px solid var(--navy);
	}
	.index li {
		border-bottom: 1px dashed var(--haze);
	}
	.index a {
		display: grid;
		grid-template-columns: 36px 52px minmax(0, auto) minmax(0, 1fr) 24px;
		align-items: center;
		gap: 14px;
		min-height: 84px;
		padding: 10px 6px;
		text-decoration: none;
		transition:
			background 0.25s,
			padding 0.35s var(--j-ease-out);
	}
	.index a:hover,
	.index a:focus-visible {
		background: var(--beige);
		padding-left: 14px;
	}
	.note {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 6px;
		border-bottom: 0 !important;
		font-size: 14px;
		color: var(--muted);
	}
	.no {
		font-family: var(--j-display);
		font-size: 15px;
		color: var(--muted);
	}
	.icon {
		display: inline-flex;
		color: var(--navy);
	}
	.index a:hover .icon {
		color: var(--laterite);
	}
	.name {
		font-family: var(--j-display);
		font-size: clamp(26px, 2.6vw, 36px);
		line-height: 1;
		letter-spacing: -0.01em;
	}
	.line {
		font-size: 14px;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.arrow {
		font-size: 20px;
		transition: transform 0.3s var(--j-ease-out);
	}
	.index a:hover .arrow {
		transform: translateX(4px) rotate(-45deg);
	}
	.preview {
		position: absolute;
		left: 0;
		top: 0;
		z-index: 4;
		width: 220px;
		padding: 8px 8px 12px;
		display: grid;
		gap: 4px;
		background: var(--white);
		border: 1.5px solid var(--navy);
		border-radius: 14px;
		box-shadow: 4px 4px 0 var(--navy);
		pointer-events: none;
		rotate: 2deg;
		transition: translate 0.18s var(--j-ease-out);
	}
	.preview img {
		width: 100%;
		height: 150px;
		object-fit: cover;
		border-radius: 8px;
		background: var(--sky);
	}
	.pname {
		font-family: var(--j-display);
		font-size: 20px;
		padding-inline: 4px;
	}
	.count {
		font-size: 12px;
		font-weight: 600;
		color: var(--muted);
		padding-inline: 4px;
	}
	@media (max-width: 900px) {
		.index {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (max-width: 520px) {
		.index a {
			grid-template-columns: 28px 44px minmax(0, 1fr) 20px;
			min-height: 72px;
		}
		.line {
			display: none;
		}
	}
	@media (hover: none) {
		.preview {
			display: none;
		}
	}
</style>
