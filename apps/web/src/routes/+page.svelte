<script lang="ts">
	import '#lib/journal/journal.css';
	import Meta from '#lib/components/Meta.svelte';
	import Hero from '#lib/journal/landing/Hero.svelte';
	import TalukaMap from '#lib/journal/landing/TalukaMap.svelte';
	import { HERO } from '#lib/journal/content/landing.ts';
	import { tr, locale } from '#lib/journal/i18n.ts';

	// Landing (docs/crabwalk-handoff/PLAN.md, owner 2026-11-22: replaces "/", Discover moved to /discover).
	// Sections in the reference order; each section's motion starts only when it nears the viewport.
</script>

<Meta title="Crabwalk" description={tr(HERO.sub)} />
<svelte:head>
	<link rel="preload" href="/fonts/journal-display-latin.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
	<link rel="preload" href="/fonts/journal-text-latin.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<div class="journal" lang={locale()}>
	<main id="main">
		<Hero />
		<TalukaMap />
	</main>
</div>
