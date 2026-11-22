<script lang="ts">
	import '#lib/journal/journal.css';
	import Meta from '#lib/components/Meta.svelte';
	import Hero from '#lib/journal/landing/Hero.svelte';
	import TalukaMap from '#lib/journal/landing/TalukaMap.svelte';
	import Categories from '#lib/journal/landing/Categories.svelte';
	import Gems from '#lib/journal/landing/Gems.svelte';
	import Why from '#lib/journal/landing/Why.svelte';
	import MeetCrabby from '#lib/journal/landing/MeetCrabby.svelte';
	import Planner from '#lib/journal/landing/Planner.svelte';
	import Verdict from '#lib/journal/landing/Verdict.svelte';
	import Closing from '#lib/journal/landing/Closing.svelte';
	import ScrollCrab from '#lib/journal/landing/ScrollCrab.svelte';
	import { HERO } from '#lib/journal/content/landing.ts';
	import { onMount } from 'svelte';
	import { tr, locale, whenDevaReady } from '#lib/journal/i18n.ts';

	// Landing (docs/crabwalk-handoff/PLAN.md, owner 2026-11-22: replaces "/", Discover moved to /discover).
	// Sections in the reference order; each section's motion starts only when it nears the viewport.
	let devaReady = $state(false);
	onMount(() => whenDevaReady(() => (devaReady = true)));
</script>

<Meta title="Crabwalk" description={tr(HERO.sub)} />
<svelte:head>
	<link
		rel="preload"
		href="/fonts/journal-display-latin.woff2"
		as="font"
		type="font/woff2"
		crossorigin="anonymous"
	/>
	<noscript
		><style>
			.journal .deva text {
				opacity: 1 !important;
			}
		</style></noscript
	>
</svelte:head>

<div class={['journal', devaReady && 'deva-ready']} lang={locale()}>
	<!-- shared filters: duotone for photos (navy shadows, beige highlights) -->
	<svg width="0" height="0" class="defs" aria-hidden="true">
		<filter id="j-duotone" color-interpolation-filters="sRGB">
			<feColorMatrix
				type="matrix"
				values=".33 .33 .33 0 0 .33 .33 .33 0 0 .33 .33 .33 0 0 0 0 0 1 0"
			/>
			<feComponentTransfer>
				<feFuncR type="table" tableValues="0.184 0.961" />
				<feFuncG type="table" tableValues="0.255 0.937" />
				<feFuncB type="table" tableValues="0.337 0.922" />
			</feComponentTransfer>
		</filter>
	</svg>
	<main id="main">
		<Hero />
		<TalukaMap />
		<Categories />
		<Gems />
		<Why />
		<MeetCrabby />
		<Planner />
		<Verdict />
		<Closing />
	</main>
	<ScrollCrab />
</div>

<style>
	.defs {
		position: absolute;
	}
</style>
