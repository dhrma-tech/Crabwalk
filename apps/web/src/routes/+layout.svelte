<script lang="ts">
	import '../app.css';
	import { m } from '#lib/paraglide/messages.js';
	import AppNav from '#lib/components/AppNav.svelte';
	import Toaster from '#lib/components/Toaster.svelte';
	import RouteProgress from '#lib/components/RouteProgress.svelte';
	import CrabbyBubble from '#lib/components/crabby/CrabbyBubble.svelte';
	import CrabbyDriver from '#lib/components/crabby/CrabbyDriver.svelte';
	import { onMount, untrack } from 'svelte';
	import { afterNavigate, onNavigate } from '$app/navigation';
	import { track } from '#lib/track.ts';
	import { watchVitals } from '#lib/vitals.ts';
	import { logActivity } from '#lib/activity.ts';
	import { page } from '$app/state';
	import { guardPlainForms } from '#lib/forms.ts';
	import { startOutbox } from '#lib/outbox.ts';
	import { booted, dataSaver, lowEnd, reducedMotion } from '#lib/motion.ts';
	import { driver } from '#lib/drive.svelte.ts';
	import { devBypass } from '#lib/devAuth.ts';
	import { devClient } from '#lib/devAuth.client.ts';
	import { isJournal } from '#lib/nav.ts';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();
	onMount(guardPlainForms);
	onMount(startOutbox);
	// First-party analytics (T1-11): route ids only, never the address.
	afterNavigate(() => track('page_view'));
	onMount(watchVitals);
	onMount(booted);
	onMount(() => {
		if (devBypass(location.hostname)) return devClient();
	});
	// Brief section 4.2: data saver or a low-end phone → no reveals, no ambient loops (`html[data-lite]` in CSS).
	$effect(() => {
		document.documentElement.toggleAttribute('data-lite', dataSaver.current || lowEnd());
	});
	// Profile activity source (P12): a listing view, only when the user switched that source on.
	const VIEW = {
		'/place/[slug]': 'place',
		'/stays/[slug]': 'stay',
		'/food/[slug]': 'eatery',
		'/taste-konkan/[dish]': 'dish'
	} as const;
	// Runs on the first page load and after every navigation.
	$effect(() => {
		const type = VIEW[page.route.id as keyof typeof VIEW];
		const slug = page.params.slug ?? page.params.dish;
		if (type && slug) untrack(() => logActivity({ kind: 'view', type, slug }));
	});
	// Page transitions (brief section 4.3; View Transitions where supported, none under reduced motion).
	// `data-nav`: tab roots and Crabby's drive steps cross-fade; back rises from above; anything else from below.
	const TABS = ['/discover', '/map', '/crabby', '/plan/new', '/me'];
	let tapped: HTMLElement | null = null;
	onMount(() => {
		const click = (e: MouseEvent) => {
			const a = (e.target as Element | null)?.closest('a');
			tapped = a?.querySelector<HTMLElement>('[data-vt-photo]') ?? null;
		};
		addEventListener('click', click, true);
		return () => removeEventListener('click', click, true);
	});
	const photoLinkingTo = (path: string) =>
		[...document.querySelectorAll<HTMLAnchorElement>('a[href]')]
			.find((a) => a.pathname === path)
			?.querySelector<HTMLElement>('[data-vt-photo]') ?? null;
	onNavigate((nav) => {
		const card = tapped;
		tapped = null;
		if (!document.startViewTransition || reducedMotion.current) return;
		const to = nav.to?.url.pathname ?? '';
		const back = nav.type === 'popstate' && (nav.delta ?? 0) < 0;
		document.documentElement.dataset.nav =
			driver.status || TABS.includes(to) ? 'tab' : back ? 'back' : 'forward';
		// Shared hero: one element holds the name at a time. Forward: the tapped card's photo (the old page's own
		// hero gives the name up); back: the hero morphs into the card that links to the page being left.
		const named: HTMLElement[] = [];
		const name = (el: HTMLElement | null) => {
			if (!el) return;
			el.style.viewTransitionName = 'hero';
			named.push(el);
		};
		const heroes = [...document.querySelectorAll<HTMLElement>('[data-vt-hero]')];
		if (card && nav.type === 'link' && card.closest('a')?.pathname === to) {
			for (const h of heroes) h.style.viewTransitionName = 'none';
			name(card);
		}
		return new Promise((done) => {
			const t = document.startViewTransition(async () => {
				done();
				await nav.complete;
				for (const el of [...named, ...heroes]) el.style.viewTransitionName = '';
				if (back && nav.from && !document.querySelector('[data-vt-hero]'))
					name(photoLinkingTo(nav.from.url.pathname));
			});
			t.finished.finally(() => {
				for (const el of named) el.style.viewTransitionName = '';
			});
		});
	});
</script>

<svelte:head>
	<!-- TODO(before-deploy): restore full auth — no indexing while the temp gate is on. -->
	{#if data.gate.on}<meta name="robots" content="noindex, nofollow" />{/if}
</svelte:head>

<a
	href="#main"
	class="sr-only z-overlay rounded-md bg-surface px-4 py-2 shadow-e3 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
	>{m.skip_to_content()}</a
>
<!-- Content keeps clear of the floating phone nav, and on laptops of the docked Crabby panel when it is open. -->
<div
	class={[
		'flex min-h-dvh flex-col lg:[&:has(~[data-dock])]:pr-(--dock-w)',
		page.route.id !== '/navigate' && !isJournal(page.route.id) && 'pb-(--nav-h)'
	]}
>
	{@render children()}
</div>
<RouteProgress />
<AppNav />
<CrabbyBubble />
<CrabbyDriver />
<Toaster />
