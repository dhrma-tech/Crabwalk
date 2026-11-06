<script lang="ts">
	import '../app.css';
	import { m } from '#lib/paraglide/messages.js';
	import AppNav from '#lib/components/AppNav.svelte';
	import Toaster from '#lib/components/Toaster.svelte';
	import CrabbyBubble from '#lib/components/crabby/CrabbyBubble.svelte';
	import CrabbyDriver from '#lib/components/crabby/CrabbyDriver.svelte';
	import { onMount, untrack } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import { logActivity } from '#lib/activity.ts';
	import { page } from '$app/state';
	import { guardPlainForms } from '#lib/forms.ts';
	import { devBypass } from '#lib/devAuth.ts';
	import { devClient } from '#lib/devAuth.client.ts';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();
	onMount(guardPlainForms);
	onMount(() => {
		if (devBypass(location.hostname)) return devClient();
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
	// Report 2 §5: client navigations cross-fade (View Transitions, where supported); none under reduced motion.
	onNavigate((nav) => {
		if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches)
			return;
		return new Promise((done) => {
			document.startViewTransition(async () => {
				done();
				await nav.complete;
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
		page.route.id !== '/navigate' && 'pb-(--nav-h)'
	]}
>
	{@render children()}
</div>
<AppNav />
<CrabbyBubble />
<CrabbyDriver />
<Toaster />
