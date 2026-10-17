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

	// FRONTEND §6.4 [LOCKED]: 4-colour segmented bar + winning label + % + votes; group control below;
	// "New" (< 10 votes) = grey outline + label.
	let {
		type,
		all,
		groups
	}: { type: EntityType; all: Agg | null; groups: Partial<Record<string, Agg>> } = $props();
	let group = $state<(typeof GROUP_KEYS)[number]>('all');
	const agg = $derived(group === 'all' ? all : (groups[group] ?? null));
	const colours = ['var(--v1)', 'var(--v2)', 'var(--v3)', 'var(--v4)'];
</script>

<section class="flex flex-col gap-3" data-testid="verdict-gauge" aria-label={m.verdict_title()}>
	<h2 class="type-h2">{m.verdict_title()}</h2>
	{#if !agg || agg.total === 0}
		<div class="h-4 rounded-chip border-2 border-dashed border-border" aria-hidden="true"></div>
		<p class="type-body text-text-2">{m.verdict_none()}</p>
	{:else if agg.is_new}
		<div
			class="flex h-4 overflow-hidden rounded-chip border-2 border-sand-500"
			aria-hidden="true"
		></div>
		<p class="flex flex-wrap items-center gap-2 type-body">
			<span class="rounded-chip border border-sand-500 px-2 py-0.5 type-tiny text-text-2"
				>{m.verdict_new()}</span
			>
			<span class="text-text-2" data-testid="gauge-count"
				>{m.verdict_votes({ n: formatNumber(agg.total) })}</span
			>
		</p>
	{:else}
		<div
			class="flex h-4 overflow-hidden rounded-chip"
			role="img"
			aria-label={agg.counts.map((c, i) => `${msg(`verdict_${type}_${i + 1}`)} ${c}`).join(', ')}
		>
			{#each agg.counts as c, i (i)}
				{#if c}<span style:width="{(c / agg.total) * 100}%" style:background={colours[i]}
					></span>{/if}
			{/each}
		</div>
		<p class="type-body">
			<strong class="type-h3" data-testid="gauge-winner"
				>{msg(`verdict_${type}_${agg.winner_level}`)}</strong
			>
			<span data-testid="gauge-pct"
				>{m.verdict_pct({
					pct: Math.round((agg.winner_pct ?? 0) * 100),
					label: msg(`verdict_${type}_${agg.winner_level}`)
				})}</span
			>
			·
			<span class="text-text-2" data-testid="gauge-count"
				>{m.verdict_votes({ n: formatNumber(agg.total) })}</span
			>
		</p>
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
	<div
		class="flex w-fit flex-wrap rounded-chip border border-border bg-surface p-0.5"
		role="group"
		aria-label={m.vote_as()}
	>
		{#each GROUP_KEYS as g (g)}
			<button
				type="button"
				aria-pressed={group === g}
				class={[
					'min-h-10 rounded-chip px-3 type-small',
					group === g ? 'bg-sea-500 text-white' : 'text-text-2'
				]}
				onclick={() => (group = g)}>{msg(`group_${g}`)}</button
			>
		{/each}
	</div>
</section>
