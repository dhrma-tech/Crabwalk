<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import type { Agg, EntityType } from './VerdictGauge.svelte';

	// Card-size gauge (FRONTEND §6.3): All-groups aggregate.
	let { type, agg }: { type: EntityType; agg: Agg | null } = $props();
	const colours = ['var(--v1)', 'var(--v2)', 'var(--v3)', 'var(--v4)'];
</script>

{#if agg && agg.total}
	<div class="flex items-center gap-2">
		{#if agg.is_new}
			<span class="h-1 flex-1 border border-text-2" aria-hidden="true"></span>
			<span class="type-label text-text-2">{m.verdict_new()}</span>
		{:else}
			<span class="flex h-1 flex-1 gap-0.5 overflow-hidden" aria-hidden="true">
				{#each agg.counts as c, i (i)}{#if c}<span
							class="basis-0"
							style:flex-grow={c}
							style:background={colours[i]}
						></span>{/if}{/each}
			</span>
			<span class="text-[12px] text-text-2"
				>{msg(`verdict_${type}_${agg.winner_level}`)} · {Math.round(
					(agg.winner_pct ?? 0) * 100
				)}%</span
			>
		{/if}
	</div>
{/if}
