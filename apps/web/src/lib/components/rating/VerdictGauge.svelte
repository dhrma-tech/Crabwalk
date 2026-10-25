<script lang="ts" module>
	export type Agg = {
		counts: number[];
		total: number;
		winner_level: number | null;
		winner_pct: number | null;
		is_new: boolean;
	};
	export type EntityType = 'place' | 'stay' | 'eatery';
	export const GROUP_KEYS = ['all', 'family', 'couple', 'solo', 'friends'] as const;
</script>

<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import { formatNumber } from '#lib/format.ts';
	import Segmented from '../Segmented.svelte';

	// FRONTEND §6.4 [LOCKED]: 4-colour segmented bar + winning label + % + votes; group control below;
	// "New" (< 10 votes) = outline bar + label. Report 2 §8: a card, the winner as a heading, the % at display
	// size, a 12 px pill bar with 2 px gaps and a label under each band.
	let {
		type,
		all,
		groups
	}: { type: EntityType; all: Agg | null; groups: Partial<Record<string, Agg>> } = $props();
	let group = $state<(typeof GROUP_KEYS)[number]>('all');
	const agg = $derived(group === 'all' ? all : (groups[group] ?? null));
	const colours = ['var(--v1)', 'var(--v2)', 'var(--v3)', 'var(--v4)'];
</script>

<section
	class="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-e1 lg:p-5"
	data-testid="verdict-gauge"
	aria-label={m.verdict_title()}
>
	<h2 class="type-label text-text-2">{m.verdict_title()}</h2>
	{#if !agg || agg.total === 0}
		<div
			class="h-3 rounded-full border-[1.5px] border-dashed border-border-strong"
			aria-hidden="true"
		></div>
		<p class="type-body text-text-2">{m.verdict_none()}</p>
	{:else if agg.is_new}
		<div
			class="h-3 rounded-full border-[1.5px] border-dashed border-border-strong"
			aria-hidden="true"
		></div>
		<p class="flex flex-wrap items-center gap-2 type-body">
			<span
				class="inline-flex min-h-7 items-center rounded-full border-[1.5px] border-dashed border-border-strong px-2.5 type-label"
				>{m.verdict_new()}</span
			>
			<span class="text-text-2" data-testid="gauge-count"
				>{m.verdict_votes({ n: formatNumber(agg.total) })}</span
			>
		</p>
	{:else}
		{@const winner = msg(`verdict_${type}_${agg.winner_level}`)}
		{@const pct = Math.round((agg.winner_pct ?? 0) * 100)}
		<div class="flex items-end justify-between gap-3">
			<div class="min-w-0">
				<p class="type-h2" data-testid="gauge-winner">{winner}</p>
				<p class="type-small text-text-2" data-testid="gauge-count">
					{m.verdict_votes({ n: formatNumber(agg.total) })}
				</p>
			</div>
			<p class="shrink-0 type-display" data-testid="gauge-pct">
				<span aria-hidden="true">{pct}%</span><span class="sr-only"
					>{m.verdict_pct({ pct, label: winner })}</span
				>
			</p>
		</div>
		<div
			class="flex h-3 gap-0.5"
			role="img"
			aria-label={agg.counts.map((c, i) => `${msg(`verdict_${type}_${i + 1}`)} ${c}`).join(', ')}
		>
			{#each agg.counts as c, i (i)}
				{#if c}<span class="basis-0 rounded-full" style:flex-grow={c} style:background={colours[i]}
					></span>{/if}
			{/each}
		</div>
		<ul class="flex flex-wrap gap-x-4 gap-y-1 type-small text-text-2">
			{#each agg.counts as c, i (i)}
				<li class="flex items-center gap-1.5">
					<span class="size-2.5 rounded-full" style:background={colours[i]} aria-hidden="true"
					></span>{msg(`verdict_${type}_${i + 1}`)}
					{c}
				</li>
			{/each}
		</ul>
	{/if}
	<div class="mt-1">
		<Segmented
			bind:value={group}
			label={m.vote_as()}
			options={GROUP_KEYS.map((g) => ({ value: g, label: msg(`group_${g}`) }))}
		/>
	</div>
</section>
