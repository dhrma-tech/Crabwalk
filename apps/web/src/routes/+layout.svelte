<script lang="ts">
	import '../app.css';
	import { m } from '#lib/paraglide/messages.js';
	import AppNav from '#lib/components/AppNav.svelte';
	import OfflineBanner from '#lib/components/OfflineBanner.svelte';
	import Toaster from '#lib/components/Toaster.svelte';
	import CrabbyBubble from '#lib/components/crabby/CrabbyBubble.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<a
	href="#main"
	class="sr-only z-50 border border-text bg-bg px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
	>{m.skip_to_content()}</a
>
<OfflineBanner />
<!-- Content leaves room for the phone nav, and on laptops for the docked Crabby panel when it shows. -->
<div
	class="flex min-h-dvh flex-col pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0 lg:[&:has(~[data-dock])]:pr-[340px]"
>
	{@render children()}
</div>
<AppNav />
<CrabbyBubble />
<Toaster />
