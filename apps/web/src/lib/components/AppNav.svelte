<script lang="ts">
	import Compass from '@lucide/svelte/icons/compass';
	import MapIcon from '@lucide/svelte/icons/map';
	import Route from '@lucide/svelte/icons/route';
	import CircleUser from '@lucide/svelte/icons/circle-user';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { crabby } from '#lib/crabby.svelte.ts';
	import { isActive } from '#lib/nav.ts';
	import Crabby from './Crabby.svelte';

	// Phones (Report 2 §7.1): a floating glass bar 12 px above the safe area with Crabby raised in the centre;
	// the current item gets a kokum icon and dot. Laptops navigate from the top bar (T-3). Hidden while typing
	// (the on-screen keyboard is up), on /navigate and under the emergency card.
	const items = [
		{ href: resolve('/'), label: m.nav_discover, icon: Compass },
		{ href: resolve('/map'), label: m.nav_map, icon: MapIcon },
		{ href: resolve('/crabby'), label: m.nav_crabby, icon: null },
		{ href: resolve('/plan/new'), label: m.nav_plan, icon: Route },
		{ href: resolve('/me'), label: m.nav_me, icon: CircleUser }
	];

	let typing = $state(false);
	onMount(() => {
		const field = (t: EventTarget | null) =>
			t instanceof HTMLElement &&
			t.matches(
				'input:not([type=checkbox],[type=radio],[type=range],[type=file],[type=button],[type=submit]),textarea,[contenteditable]'
			);
		const onIn = (e: FocusEvent) => (typing = field(e.target));
		const onOut = (e: FocusEvent) => (typing = field(e.relatedTarget));
		addEventListener('focusin', onIn);
		addEventListener('focusout', onOut);
		return () => {
			removeEventListener('focusin', onIn);
			removeEventListener('focusout', onOut);
		};
	});
	const hidden = $derived(typing || page.route.id === '/navigate' || crabby.emergency);
</script>

<nav
	aria-label={m.nav_label()}
	data-clip-check
	class={[
		'fixed inset-x-4 bottom-[calc(12px+env(safe-area-inset-bottom))] z-bar mx-auto max-w-140 lg:hidden print:hidden',
		hidden && 'hidden'
	]}
>
	<ul class="glass grid h-17 grid-cols-5 rounded-xl shadow-e2">
		{#each items as item (item.href)}
			{@const on = isActive(page.url.pathname, item.href)}
			<li class="flex">
				<a
					href={item.href}
					aria-current={on ? 'page' : undefined}
					class={[
						'relative flex flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-center type-label no-underline',
						on ? 'text-text' : 'text-text-2'
					]}
				>
					{#if item.icon}
						{@const Icon = item.icon}
						<Icon size={24} aria-hidden="true" class={on ? 'text-kokum' : undefined} />
						<span>{item.label()}</span>
						{#if on}<span class="absolute bottom-1 size-1 rounded-full bg-kokum"></span>{/if}
					{:else}
						<span
							class="absolute -top-3.5 flex size-14 items-center justify-center rounded-full bg-kokum shadow-e2"
							><Crabby size={36} tone="white" /></span
						>
						<span class="mt-auto pb-1.5">{item.label()}</span>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
</nav>
