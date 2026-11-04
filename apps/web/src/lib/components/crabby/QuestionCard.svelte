<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import { untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { answerText, type Question } from '#lib/questions.ts';
	import Button from '../Button.svelte';

	// "Ask, don't assume" (product plan §4, P12 step C): Crabby's questions as one card. Tap an option (several
	// where it says so), type "Other", or leave a choice to Crabby; the answers go back as the next message.
	let {
		questions,
		answered = false,
		onanswer
	}: { questions: Question[]; answered?: boolean; onanswer: (text: string) => void } = $props();

	// A card's questions never change; its picks are set up once.
	const picks = $state(
		untrack(() => questions.map(() => ({ options: [] as number[], other: '', decide: false })))
	);
	const ready = $derived(picks.every((p) => p.decide || p.options.length || p.other.trim().length));
	function toggle(k: number, i: number) {
		const p = picks[k]!;
		p.decide = false;
		if (questions[k]!.multi)
			p.options = p.options.includes(i) ? p.options.filter((x) => x !== i) : [...p.options, i];
		else {
			p.options = p.options[0] === i ? [] : [i];
			p.other = '';
		}
	}
	const chip =
		'inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 py-1.5 text-left type-label disabled:opacity-60';
</script>

<form
	class="flex flex-col gap-4 rounded-lg border-l-4 border-lagoon bg-surface p-4 shadow-e1"
	data-testid="question-card"
	onsubmit={(e) => {
		e.preventDefault();
		if (ready && !answered) onanswer(answerText(questions, picks, m.q_decide()));
	}}
>
	{#each questions as q, k (k)}
		{@const p = picks[k]!}
		<fieldset class="flex flex-col gap-2" disabled={answered}>
			<legend class="mb-1 flex flex-col gap-0.5">
				<span class="type-label text-text-2">{q.header}</span>
				<span class="type-body-strong text-text">{q.question}</span>
				{#if q.multi}<span class="type-small text-text-2">{m.q_pick_any()}</span>{/if}
			</legend>
			<div
				class="flex flex-wrap gap-2"
				role={q.multi ? 'group' : 'radiogroup'}
				aria-label={q.header}
			>
				{#each q.options as o, i (i)}
					{@const on = p.options.includes(i)}
					<button
						type="button"
						role={q.multi ? 'checkbox' : 'radio'}
						aria-checked={on}
						class={[
							chip,
							on
								? 'border-kokum bg-kokum text-on-kokum'
								: 'border-border-strong bg-surface text-text hover:bg-surface-2'
						]}
						onclick={() => toggle(k, i)}
					>
						{#if on}<Check size={16} aria-hidden="true" />{/if}{o.label}
						{#if o.recommended}<span
								class={['type-small', on ? 'text-on-kokum' : 'text-lagoon-ink']}
								>· {m.q_recommended()}</span
							>{/if}
					</button>
				{/each}
				{#if q.decide}
					<button
						type="button"
						role={q.multi ? 'checkbox' : 'radio'}
						aria-checked={p.decide}
						class={[
							chip,
							p.decide
								? 'border-lagoon bg-lagoon text-on-lagoon'
								: 'border-border-strong bg-surface text-text hover:bg-surface-2'
						]}
						onclick={() => {
							p.decide = !p.decide;
							if (p.decide) {
								p.options = [];
								p.other = '';
							}
						}}>{m.q_decide()}</button
					>
				{/if}
			</div>
			<input
				value={p.other}
				oninput={(e) => {
					p.other = e.currentTarget.value;
					if (p.other.trim()) {
						p.decide = false;
						if (!q.multi) p.options = [];
					}
				}}
				maxlength="120"
				aria-label={m.q_other_label({ header: q.header })}
				placeholder={m.q_other()}
				class="field h-11 px-3 type-body text-text"
			/>
		</fieldset>
	{/each}
	{#if answered}
		<p class="type-small text-text-2" role="status">{m.q_sent()}</p>
	{:else}
		<div><Button type="submit" disabled={!ready}>{m.q_send()}</Button></div>
	{/if}
</form>
