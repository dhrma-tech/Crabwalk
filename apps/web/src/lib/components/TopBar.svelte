<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import Search from '@lucide/svelte/icons/search';
	import CircleUser from '@lucide/svelte/icons/circle-user';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { isActive } from '#lib/nav.ts';
	import LanguageSwitch from './LanguageSwitch.svelte';
	import BrandMark from './BrandMark.svelte';
	import SearchBox from './SearchBox.svelte';
	import OfflineBanner from './OfflineBanner.svelte';

	// Report 2 §7 (T-3, T-21). Phones: back chevron or the mark (the wordmark on Discover), the title, search,
	// language pill. Laptops: one persistent bar, full width even with Crabby docked: wordmark, links, search,
	// language, Me. The page <h1> lives in <main>, so the title here is visual only. Page colour at the top,
	// surface + e2 once the page scrolls. The offline pill hangs under the bar.
	let { title, back = false }: { title: string; back?: boolean } = $props();
	const home = $derived(page.url.pathname === '/');
	const links = [
		{ href: resolve('/'), label: m.nav_discover },
		{ href: resolve('/map'), label: m.nav_map },
		{ href: resolve('/plan/new'), label: m.nav_plan },
		{ href: resolve('/itineraries'), label: m.itin_title },
		{ href: resolve('/taste-konkan'), label: m.taste_title }
	];
	const icon =
		'flex size-11 shrink-0 items-center justify-center rounded-full no-underline transition-colors duration-200';

	let sentinel: HTMLElement | undefined = $state();
	let scrolled = $state(false);
	$effect(() => {
		if (!sentinel) return;
		const io = new IntersectionObserver(([e]) => (scrolled = !e!.isIntersecting));
		io.observe(sentinel);
		return () => io.disconnect();
	});

	function goBack(e: MouseEvent) {
		if (history.length > 1) {
			e.preventDefault();
			history.back();
		}
	}
</script>

<div bind:this={sentinel} class="pointer-events-none absolute top-0 left-0 h-px w-px"></div>
<header
	class={[
		'sticky top-0 z-bar pt-[env(safe-area-inset-top)] transition-[background-color,box-shadow] duration-200 print:hidden',
		'lg:[:has(~[data-dock])>&]:-mr-(--dock-w)',
		scrolled ? 'bg-surface shadow-e2' : 'bg-bg'
	]}
>
	<div class="flex min-h-14 items-center gap-1 px-3 lg:hidden" data-clip-check>
		{#if back}
			<a
				href={resolve('/')}
				class={[icon, 'text-text hover:bg-surface-2']}
				aria-label={m.back()}
				onclick={goBack}><ChevronLeft size={24} aria-hidden="true" /></a
			>
		{:else}
			<a
				href={resolve('/')}
				class="flex min-h-11 min-w-11 shrink-0 items-center justify-center px-1 no-underline"
				aria-label={m.app_name()}
				aria-current={home ? 'page' : undefined}><BrandMark wordmark={home} /></a
			>
		{/if}
		{#if home}
			<span class="flex-1"></span>
		{:else}
			<p class="min-w-0 flex-1 px-1 type-h3 wrap-anywhere text-text" aria-hidden="true">{title}</p>
			<a
				href="{resolve('/')}#search"
				class={[icon, 'text-text hover:bg-surface-2']}
				aria-label={m.search()}><Search size={22} aria-hidden="true" /></a
			>
		{/if}
		<LanguageSwitch />
	</div>

	<div class="mx-auto hidden h-18 max-w-300 items-center gap-4 px-8 lg:flex" data-clip-check>
		<a
			href={resolve('/')}
			class="flex min-h-11 shrink-0 items-center no-underline"
			aria-label={m.app_name()}
			aria-current={home ? 'page' : undefined}><BrandMark wordmark /></a
		>
		<nav aria-label={m.nav_label()}>
			<ul class="flex items-center">
				{#each links as l (l.href)}
					{@const on = isActive(page.url.pathname, l.href)}
					<li>
						<a
							href={l.href}
							aria-current={on ? 'page' : undefined}
							class={[
								'relative flex min-h-11 items-center rounded-full px-3 type-body whitespace-nowrap no-underline transition-colors duration-200',
								on ? 'font-semibold text-text' : 'text-text-2 hover:bg-surface-2 hover:text-text'
							]}
							>{l.label()}{#if on}<span
									class="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-kokum"
								></span>{/if}</a
						>
					</li>
				{/each}
			</ul>
		</nav>
		<SearchBox class="mx-auto max-w-120 min-w-0 flex-1" />
		<LanguageSwitch />
		<a
			href={resolve('/me')}
			class={[icon, 'bg-surface-2 text-text-2 hover:text-text']}
			aria-label={m.nav_me()}
			aria-current={isActive(page.url.pathname, '/me') ? 'page' : undefined}
			><CircleUser size={24} aria-hidden="true" /></a
		>
	</div>

	<div class="pointer-events-none absolute inset-x-0 top-full flex justify-center px-4 pt-2">
		<OfflineBanner />
	</div>
</header>
