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
	import { isActive, isJournal } from '#lib/nav.ts';
	import Crabby from './CrabbyMark.svelte';

	// Phones (Report 2 §7.1): a floating glass bar 12 px above the safe area with Crabby raised in the centre;
	// the current item gets a kokum icon and dot. Laptops navigate from the top bar (T-3). Hidden while typing
	// (the on-screen keyboard is up), on /navigate and under the emergency card.
	const items = [
		{ href: resolve('/discover'), label: m.nav_discover, icon: Compass, drive: 'discover' },
		{ href: resolve('/map'), label: m.nav_map, icon: MapIcon, drive: 'map' },
		{ href: resolve('/crabby'), label: m.nav_crabby, icon: null, drive: 'crabby' },
		{ href: resolve('/plan/new'), label: m.nav_plan, icon: Route, drive: 'plan_new' },
		{ href: resolve('/me'), label: m.nav_me, icon: CircleUser, drive: 'me' }
	];

	let typing = $state(false);
	onMount(() => {
		const field = (t: EventTarget | null) =>
			t instanceof HTMLElement &&
			t.matches(
				'input:not([type=checkbox],[type=radio],[type=range],[type=file],[type=button],[type=submit]),textarea,[contenteditable]'
			);
		const onIn = (e: FocusEvent) => (typing = field(e.target));
		// Deferred: focusout also fires when a focused element is removed mid-update, where writing state throws
		// state_unsafe_mutation (found via the admin editor, ADMIN_ACCESS_CHANGES.md).
		const onOut = (e: FocusEvent) => queueMicrotask(() => (typing = field(e.relatedTarget)));
		addEventListener('focusin', onIn);
		addEventListener('focusout', onOut);
		return () => {
			removeEventListener('focusin', onIn);
			removeEventListener('focusout', onOut);
		};
	});
	const hidden = $derived(
		typing || page.route.id === '/navigate' || crabby.emergency || isJournal(page.route.id)
	);
	// Brief section 4.7: one dot slides to the active tab (none for Crabby's raised button or other pages).
	const active = $derived(items.findIndex((i) => isActive(page.url.pathname, i.href)));
</script>

<nav
	style:view-transition-name="appnav"
	aria-label={m.nav_label()}
	data-clip-check
	class={[
		'fixed inset-x-4 bottom-[calc(12px+env(safe-area-inset-bottom))] z-bar mx-auto max-w-140 lg:hidden print:hidden',
		hidden && 'hidden'
	]}
>
	<ul class="glass relative grid h-17 grid-cols-5 rounded-xl shadow-e2">
		<li
			class={[
				'pointer-events-none absolute inset-y-0 left-0 flex w-1/5 justify-center transition-[transform,opacity] duration-(--dur-state) ease-(--ease-inout)',
				(active < 0 || !items[active]?.icon) && 'opacity-0'
			]}
			style:transform="translateX({Math.max(active, 0) * 100}%)"
			aria-hidden="true"
			data-nav-dot
		>
			<span class="absolute bottom-1 size-1 rounded-full bg-kokum"></span>
		</li>
		{#each items as item (item.href)}
			{@const on = isActive(page.url.pathname, item.href)}
			<li class="flex">
				<a
					href={item.href}
					data-drive="openPage:{item.drive}"
					aria-current={on ? 'page' : undefined}
					class={[
						'group/press relative flex flex-1 flex-col items-center justify-center px-0.5 text-center type-label no-underline',
						on ? 'text-text' : 'text-text-2'
					]}
				>
					{#if item.icon}
						{@const Icon = item.icon}
						<span
							class="flex flex-col items-center gap-0.5 transition-transform duration-(--dur-press) ease-brand group-active/press:scale-[.97]"
						>
							<Icon size={24} aria-hidden="true" class={on ? 'text-kokum' : undefined} />
							<span>{item.label()}</span>
						</span>
					{:else}
						<span
							class="absolute -top-3.5 flex size-14 items-center justify-center rounded-full bg-kokum shadow-e2 transition-transform duration-(--dur-press) ease-brand group-active/press:scale-[.97]"
							><Crabby size={36} tone="white" /></span
						>
						<span class="mt-auto pb-1.5">{item.label()}</span>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
</nav>
