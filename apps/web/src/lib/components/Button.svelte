<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Phone from '@lucide/svelte/icons/phone';
	import Crabby from './Crabby.svelte';

	// FRONTEND §6.1. Primary: one per screen. Emergency: emergency card / QR page only.
	type Props = HTMLButtonAttributes & {
		variant?: 'primary' | 'secondary' | 'ghost' | 'emergency';
		href?: string;
		loading?: boolean;
		icon?: Snippet;
		children: Snippet;
	};
	let {
		variant = 'primary',
		href,
		loading = false,
		icon,
		children,
		class: cls,
		type = 'button',
		...rest
	}: Props = $props();

	const styles = {
		primary: 'min-h-12 px-6 bg-cta text-on-cta type-h3',
		secondary: 'min-h-10 px-5 border-2 border-link text-link type-h3 hit',
		ghost: 'min-h-10 px-4 text-link type-h3 hit',
		emergency: 'min-h-14 px-6 bg-emergency text-white type-h2'
	};
	// Heights are minimums: long Marathi labels wrap instead of clipping.
	const base =
		'relative inline-flex items-center justify-center gap-2 rounded-chip py-1.5 text-center ' +
		'transition-transform duration-[120ms] ease-brand active:scale-[.97] ' +
		'disabled:opacity-50 aria-disabled:opacity-50';
</script>

{#snippet content()}
	{#if loading}
		<Crabby size={20} walking />
	{:else if variant === 'emergency'}
		<Phone size={24} aria-hidden="true" />
	{:else if icon}
		{@render icon()}
	{/if}
	<span>{@render children()}</span>
{/snippet}

{#if href}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass resolve()d hrefs -->
	<a {href} class={[base, styles[variant], 'no-underline', cls]} aria-busy={loading || undefined}>
		{@render content()}
	</a>
{:else}
	<button {type} class={[base, styles[variant], cls]} aria-busy={loading || undefined} {...rest}>
		{@render content()}
	</button>
{/if}

<style>
	/* 40 px visuals still get a 44 px touch target (§2.4). */
	:global(.hit)::before {
		content: '';
		position: absolute;
		inset: -2px 0;
	}
</style>
