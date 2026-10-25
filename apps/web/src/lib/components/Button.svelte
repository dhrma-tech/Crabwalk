<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Phone from '@lucide/svelte/icons/phone';
	import Crabby from './Crabby.svelte';

	// Report 2 §8. Primary (kokum): one per screen. Emergency: emergency card / QR page only, and never moves.
	type Props = HTMLButtonAttributes & {
		variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'emergency';
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
		primary:
			'min-h-12 rounded-md px-5 bg-kokum text-on-kokum type-body-strong hover:bg-kokum-hover',
		secondary:
			'min-h-12 rounded-md px-5 bg-surface-2 text-text type-body-strong hover:bg-surface-3',
		outline:
			'min-h-12 rounded-md px-5 border-[1.5px] border-border-strong text-text type-body-strong hover:bg-surface-2',
		ghost: 'min-h-11 px-1 text-lagoon type-body-strong underline-offset-4 hover:underline',
		emergency:
			'min-h-14 rounded-md px-6 bg-emergency text-white [font:700_18px/24px_system-ui,sans-serif] hover:bg-emergency-hover'
	};
	// Heights are minimums: long Marathi labels wrap instead of clipping.
	const base = $derived([
		'relative inline-flex items-center justify-center gap-2 py-2 text-center no-underline',
		'transition-[transform,background-color] duration-(--dur-press) ease-brand',
		'disabled:text-muted disabled:no-underline aria-disabled:opacity-60',
		variant !== 'emergency' && 'active:scale-[.97] disabled:active:scale-100',
		variant !== 'ghost' && 'disabled:border-transparent disabled:bg-surface-2'
	]);
</script>

{#snippet content()}
	{#if loading}
		<Crabby size={20} walking tone={variant === 'primary' ? 'white' : 'kokum'} />
	{:else if variant === 'emergency'}
		<Phone size={24} aria-hidden="true" />
	{:else if icon}
		{@render icon()}
	{/if}
	<span>{@render children()}</span>
{/snippet}

{#if href}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass resolve()d hrefs -->
	<a {href} class={[base, styles[variant], cls]} aria-busy={loading || undefined}>
		{@render content()}
	</a>
{:else}
	<button {type} class={[base, styles[variant], cls]} aria-busy={loading || undefined} {...rest}>
		{@render content()}
	</button>
{/if}
