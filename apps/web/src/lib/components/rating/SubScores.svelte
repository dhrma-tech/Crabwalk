<script lang="ts">
	import Lock from '@lucide/svelte/icons/lock';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import { formatNumber } from '#lib/format.ts';

	// FRONTEND §6.4 / Report 2 §8: 6 px lagoon pill bars 0–5 with the value; hygiene/cleanliness show a lock +
	// "Verified visitors only".
	let { dims, subs }: { dims: string[]; subs: { dimension: string; avg: number; n: number }[] } =
		$props();
	const locked = ['hygiene', 'cleanliness'];
</script>

{#if dims.length}
	<ul class="flex flex-col gap-2.5" data-testid="sub-scores">
		{#each dims as d (d)}
			{@const s = subs.find((x) => x.dimension === d)}
			<li class="grid grid-cols-[minmax(7rem,auto)_1fr_auto] items-center gap-3 type-small">
				<span class="flex items-center gap-1"
					>{#if locked.includes(d)}<Lock size={14} aria-hidden="true" />{/if}{msg(`dim_${d}`)}</span
				>
				<span
					class="h-1.5 overflow-hidden rounded-full bg-surface-2"
					role="img"
					aria-label={s
						? m.score_of({ dim: msg(`dim_${d}`), n: formatNumber(s.avg) })
						: msg(`dim_${d}`)}
				>
					{#if s}<span
							class="block h-full rounded-full bg-lagoon"
							style:width="{(s.avg / 5) * 100}%"
						></span>{/if}
				</span>
				<span class="text-text-2">{s ? formatNumber(s.avg) : '–'}</span>
			</li>
			{#if locked.includes(d)}<li class="-mt-1.5 pl-5 type-small text-text-2">
					{m.verified_only()}
				</li>{/if}
		{/each}
	</ul>
{/if}
