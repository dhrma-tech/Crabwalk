<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { formatDate } from '#lib/format.ts';

	// FRONTEND §6.5 in Suna (3a): states are a coloured dot + text; badges are quiet tint tags with ink text.
	// Colour is never the only signal — every one carries its words.
	type Props =
		| { kind: 'tide'; state: 'ok' | 'cut'; label: string }
		| { kind: 'monsoon'; state: 'open' | 'risky' | 'closed'; label: string }
		| { kind: 'crowd'; level: 'empty' | 'calm' | 'busy'; live: boolean }
		| { kind: 'gem' }
		| { kind: 'verified' }
		| { kind: 'last-verified'; date: Date | string };
	let props: Props = $props();

	const dot = { ok: 'bg-ok', caution: 'bg-caution', danger: 'bg-danger' };
	const crowdText = { empty: m.crowd_empty, calm: m.crowd_calm, busy: m.crowd_busy };
	const tag = 'inline-flex items-center px-2.5 py-px text-[13px] text-text';
	const state = 'inline-flex items-center gap-2 type-small font-medium text-text';
</script>

{#snippet mark(c: string)}<span class={['size-2 shrink-0 rounded-full', c]} aria-hidden="true"
	></span>{/snippet}

{#if props.kind === 'tide'}
	<span class={state}
		>{@render mark(dot[props.state === 'ok' ? 'ok' : 'caution'])}{props.label}</span
	>
{:else if props.kind === 'monsoon'}
	<span class={state}
		>{@render mark(
			dot[props.state === 'open' ? 'ok' : props.state === 'risky' ? 'caution' : 'danger']
		)}{props.label}</span
	>
{:else if props.kind === 'crowd'}
	<span class={[tag, 'bg-fuji']}
		>{crowdText[props.level]()} · {props.live ? m.crowd_live() : m.crowd_typical()}</span
	>
{:else if props.kind === 'gem'}
	<span class={[tag, 'bg-yama']}>{m.hidden_gem()}</span>
{:else if props.kind === 'verified'}
	<span class={[tag, 'bg-wakaba']}>{m.verified()}</span>
{:else}
	<span class="text-[12px] text-text-2">{m.last_verified({ date: formatDate(props.date) })}</span>
{/if}
