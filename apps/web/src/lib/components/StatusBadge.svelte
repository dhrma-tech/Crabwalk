<script lang="ts">
	import Waves from '@lucide/svelte/icons/waves';
	import Gem from '@lucide/svelte/icons/gem';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import { m } from '#lib/paraglide/messages.js';
	import { formatDate } from '#lib/format.ts';

	// Report 2 §8: 28 px pill, a coloured dot or icon + ink text, on sunken grey or `glass` over photos. Danger is
	// the laterite dot, never a red fill. Colour is never the only signal — every badge carries its words.
	type Props = (
		| { kind: 'tide'; state: 'ok' | 'cut'; label: string }
		| { kind: 'monsoon'; state: 'open' | 'risky' | 'closed'; label: string }
		| { kind: 'crowd'; level: 'empty' | 'calm' | 'busy'; live: boolean }
		| { kind: 'gem' }
		| { kind: 'verified' }
		| { kind: 'last-verified'; date: Date | string }
	) & { glass?: boolean };
	let props: Props = $props();

	const dot = { ok: 'bg-ok', caution: 'bg-caution', danger: 'bg-danger' };
	const crowdText = { empty: m.crowd_empty, calm: m.crowd_calm, busy: m.crowd_busy };
	const pill = $derived([
		'inline-flex min-h-7 w-fit items-center gap-1.5 rounded-full px-2.5 type-label text-text',
		props.glass ? 'glass' : 'bg-surface-2'
	]);
</script>

{#snippet mark(c: string)}<span class={['size-2 shrink-0 rounded-full', c]} aria-hidden="true"
	></span>{/snippet}

{#if props.kind === 'tide'}
	<span class={pill}
		>{@render mark(dot[props.state === 'ok' ? 'ok' : 'danger'])}{#if props.state === 'ok'}<Waves
				size={16}
				aria-hidden="true"
				class="text-ok"
			/>{/if}{props.label}</span
	>
{:else if props.kind === 'monsoon'}
	<span class={pill}
		>{@render mark(
			dot[props.state === 'open' ? 'ok' : props.state === 'risky' ? 'caution' : 'danger']
		)}{props.label}</span
	>
{:else if props.kind === 'crowd'}
	<span class={pill}
		><span
			class={[
				'size-2 shrink-0 rounded-full',
				props.live ? 'pulse bg-lagoon' : 'border-[1.5px] border-text-2'
			]}
			aria-hidden="true"
		></span>{crowdText[props.level]()} · {props.live ? m.crowd_live() : m.crowd_typical()}</span
	>
{:else if props.kind === 'gem'}
	<span
		class="inline-flex min-h-7 w-fit items-center gap-1.5 rounded-full bg-alphonso px-2.5 type-label text-on-alphonso"
		><Gem size={16} aria-hidden="true" />{m.hidden_gem()}</span
	>
{:else if props.kind === 'verified'}
	<span class={pill}
		><BadgeCheck size={16} aria-hidden="true" class="text-lagoon" />{m.verified()}</span
	>
{:else}
	<span class="type-small text-text-2">{m.last_verified({ date: formatDate(props.date) })}</span>
{/if}

<style>
	/* "Live" breathes softly (2 s); the global reduced-motion rule stops it. */
	.pulse {
		animation: pulse 2s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			box-shadow: 0 0 0 4px color-mix(in srgb, var(--lagoon) 25%, transparent);
		}
	}
</style>
