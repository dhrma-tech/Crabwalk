<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { afterNavigate } from '$app/navigation';
	import { m } from '#lib/paraglide/messages.js';
	import { menu } from '#lib/menu.svelte.ts';
	import Crabby from './Crabby.svelte';
	import BrandMark from './BrandMark.svelte';
	import LanguageSwitch from './LanguageSwitch.svelte';

	// Phones: bottom nav, Crabby raised in the centre (FRONTEND §5). Laptop: no rail — a drawer behind ☰
	// in the top bar (Suna 5a, DECISIONS P10a-4 overrides FRONTEND §5 "left rail").
	const items = [
		{ href: resolve('/'), label: m.nav_discover },
		{ href: resolve('/map'), label: m.nav_map },
		{ href: resolve('/crabby'), label: m.nav_crabby },
		{ href: resolve('/plan/new'), label: m.nav_plan },
		{ href: resolve('/me'), label: m.nav_me }
	];
	const active = (href: string) =>
		href === '/'
			? page.url.pathname === '/'
			: page.url.pathname.startsWith(href.split('/').slice(0, 2).join('/'));

	afterNavigate(() => (menu.open = false));
	let drawer: HTMLElement | undefined = $state();
	$effect(() => {
		if (menu.open) drawer?.querySelector('a')?.focus();
	});
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (menu.open = false)} />

<nav
	aria-label={m.nav_label()}
	data-clip-check
	class="fixed inset-x-0 bottom-0 z-bar border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
>
	<ul class="mx-auto grid h-16 max-w-[640px] grid-cols-5 items-stretch">
		{#each items as item, i (item.href)}
			{@const on = active(item.href)}
			<li class="flex">
				<a
					href={item.href}
					aria-current={on ? 'page' : undefined}
					class={[
						'relative flex flex-1 flex-col items-center justify-center px-1 text-center text-[12px] leading-tight no-underline',
						i === 2 && 'justify-end pb-1.5',
						on ? 'font-medium text-text' : 'text-text-2 hover:text-text'
					]}
				>
					{#if i === 2}
						<span class="absolute -top-[18px] left-1/2 -ml-[26px]"><Crabby size={52} /></span>
					{/if}
					<span>{item.label()}</span>
				</a>
			</li>
		{/each}
	</ul>
</nav>

{#if menu.open}
	<button
		type="button"
		class="fixed inset-0 z-banner hidden cursor-default lg:block"
		aria-label={m.close()}
		tabindex="-1"
		onclick={() => (menu.open = false)}
	></button>
	<nav
		id="app-menu"
		bind:this={drawer}
		aria-label={m.nav_label()}
		class="fixed inset-y-0 left-0 z-overlay hidden w-[230px] flex-col gap-1.5 border-r border-text bg-bg px-5 py-6 lg:flex print:hidden"
	>
		<div class="mb-6 flex items-center gap-2.5">
			<BrandMark size={28} />
			<span class="text-[17px] font-medium">{m.app_name()}</span>
		</div>
		{#each items as item (item.href)}
			{@const on = active(item.href)}
			<a
				href={item.href}
				aria-current={on ? 'page' : undefined}
				class={[
					'border-l-2 px-2.5 py-2 type-body no-underline',
					on
						? 'border-cta font-medium text-text'
						: 'border-transparent text-text-2 hover:bg-text/5 hover:text-text'
				]}>{item.label()}</a
			>
		{/each}
		<div class="flex-1"></div>
		<LanguageSwitch />
	</nav>
{/if}
