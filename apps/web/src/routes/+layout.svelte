<script lang="ts">
	import '../app.css';
	import { m } from '#lib/paraglide/messages.js';
	import AppNav from '#lib/components/AppNav.svelte';
	import Toaster from '#lib/components/Toaster.svelte';
	import CrabbyBubble from '#lib/components/crabby/CrabbyBubble.svelte';
	import { onMount } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { guardPlainForms } from '#lib/forms.ts';
	import { devBypass } from '#lib/devAuth.ts';
	import { devClient } from '#lib/devAuth.client.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	onMount(guardPlainForms);
	let devMode = $state(false);
	onMount(() => {
		devMode = devBypass(location.hostname);
		if (devMode) return devClient();
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

{#if devMode}
	<div
		class="pointer-events-none fixed bottom-[calc(var(--nav-h)+8px)] left-2 z-overlay rounded-sm bg-text px-2 py-0.5 text-[11px] font-bold text-bg"
	>
		DEV MODE
	</div>
{/if}

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
<Toaster />
