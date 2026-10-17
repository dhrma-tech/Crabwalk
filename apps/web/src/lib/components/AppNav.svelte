<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Compass from '@lucide/svelte/icons/compass';
	import MapIcon from '@lucide/svelte/icons/map';
	import Route from '@lucide/svelte/icons/route';
	import User from '@lucide/svelte/icons/user';
	import { m } from '#lib/paraglide/messages.js';
	import Crabby from './Crabby.svelte';

	// FRONTEND §5 [LOCKED]: bottom nav on phones, left rail on desktop. Crabby centre, raised.
	const items = [
		{ href: resolve('/'), label: m.nav_discover, icon: Compass },
		{ href: resolve('/map'), label: m.nav_map, icon: MapIcon },
		{ href: resolve('/crabby'), label: m.nav_crabby, icon: null },
		{ href: resolve('/plan/new'), label: m.nav_plan, icon: Route },
		{ href: resolve('/me'), label: m.nav_me, icon: User }
	];
	const active = (href: string) =>
		href === '/'
			? page.url.pathname === '/'
			: page.url.pathname.startsWith(href.split('/').slice(0, 2).join('/'));
</script>

<nav
	aria-label={m.nav_label()}
	data-clip-check
	class="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-raised pb-[env(safe-area-inset-bottom)] lg:inset-y-0 lg:right-auto lg:w-24 lg:border-t-0 lg:border-r lg:pt-4 lg:pb-0"
>
	<ul
		class="mx-auto flex h-16 max-w-[640px] items-stretch justify-around lg:h-auto lg:flex-col lg:gap-2"
	>
		{#each items as item (item.href)}
			{@const on = active(item.href)}
			<li class="flex flex-1 lg:flex-none">
				<a
					href={item.href}
					aria-current={on ? 'page' : undefined}
					class={[
						'flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 type-tiny no-underline lg:py-3',
						on ? 'text-laterite-500 dark:text-cta' : 'text-text-2'
					]}
				>
					{#if item.icon}
						<item.icon size={24} aria-hidden="true" />
					{:else}
						<span
							class="-mt-6 flex size-14 items-center justify-center rounded-full border border-border bg-raised shadow-float lg:mt-0"
						>
							<Crabby size={40} />
						</span>
					{/if}
					<span class="text-center">{item.label()}</span>
				</a>
			</li>
		{/each}
	</ul>
</nav>
