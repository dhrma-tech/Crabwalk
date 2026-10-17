<script lang="ts">
	import Waves from '@lucide/svelte/icons/waves';
	import CloudRain from '@lucide/svelte/icons/cloud-rain';
	import Users from '@lucide/svelte/icons/users';
	import Gem from '@lucide/svelte/icons/gem';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import { m } from '#lib/paraglide/messages.js';
	import { formatDate } from '#lib/format.ts';

	// FRONTEND §6.5. Every semantic colour is paired with an icon + text.
	// Text on fills: white on ok/danger (≥5:1), ink on caution (white fails AA there).
	type Props =
		| { kind: 'tide'; state: 'ok' | 'cut'; label: string }
		| { kind: 'monsoon'; state: 'open' | 'risky' | 'closed'; label: string }
		| { kind: 'crowd'; level: 'empty' | 'calm' | 'busy'; live: boolean }
		| { kind: 'gem' }
		| { kind: 'verified' }
		| { kind: 'last-verified'; date: Date | string };
	let props: Props = $props();

	const fill = {
		ok: 'bg-ok text-white',
		caution: 'bg-caution text-sand-900',
		danger: 'bg-danger text-white'
	};
	const crowdFill = {
		empty: 'bg-sea-50 text-sea-900',
		calm: 'bg-sea-100 text-sea-900',
		busy: 'bg-mango-100 text-mango-900'
	};
	const crowdText = { empty: m.crowd_empty, calm: m.crowd_calm, busy: m.crowd_busy };
	const pill = 'inline-flex items-center gap-1 rounded-chip px-2.5 py-1 type-tiny';
</script>

{#if props.kind === 'tide'}
	<span class={[pill, fill[props.state === 'ok' ? 'ok' : 'danger']]}>
		<Waves size={16} aria-hidden="true" />{props.label}
	</span>
{:else if props.kind === 'monsoon'}
	<span
		class={[
			pill,
			fill[props.state === 'open' ? 'ok' : props.state === 'risky' ? 'caution' : 'danger']
		]}
	>
		<CloudRain size={16} aria-hidden="true" />{props.label}
	</span>
{:else if props.kind === 'crowd'}
	<span class={[pill, crowdFill[props.level]]}>
		<Users size={16} aria-hidden="true" />{crowdText[props.level]()} · {props.live
			? m.crowd_live()
			: m.crowd_typical()}
	</span>
{:else if props.kind === 'gem'}
	<span class={[pill, 'bg-mango-500 text-mango-900']}>
		<Gem size={16} aria-hidden="true" />{m.hidden_gem()}
	</span>
{:else if props.kind === 'verified'}
	<span class={[pill, 'border border-link text-link']}>
		<BadgeCheck size={16} aria-hidden="true" />{m.verified()}
	</span>
{:else}
	<span class="type-small text-muted">{m.last_verified({ date: formatDate(props.date) })}</span>
{/if}
