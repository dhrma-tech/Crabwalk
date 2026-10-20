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

	// Suna 3a: aizome primary, ink-outline secondary, underlined text action; red only for emergency.
	const styles = {
		primary: 'min-h-11 px-5 bg-cta text-on-cta type-body',
		secondary: 'min-h-11 px-5 border border-text text-text type-body',
		ghost: 'min-h-11 px-1 text-text type-body underline decoration-1 underline-offset-[6px]',
		emergency: 'min-h-14 px-6 bg-emergency text-white font-bold text-[18px]'
	};
	// Heights are minimums: long Marathi labels wrap instead of clipping.
	const base =
		'relative inline-flex items-center justify-center gap-2 py-2 text-center ' +
		'transition-transform duration-[120ms] ease-brand active:scale-[.97] ' +
		'disabled:bg-border disabled:text-text-2 disabled:border-transparent aria-disabled:opacity-60';
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
