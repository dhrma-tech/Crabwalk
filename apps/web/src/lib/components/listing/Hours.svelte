<script lang="ts" module>
	export type HourRow = {
		weekday: number;
		opens: string | null;
		closes: string | null;
		hours_unknown: boolean;
	};

	/** Today's line: never assume open when hours are unknown (FRONTEND §13). */
	export function todayLine(
		rows: HourRow[],
		locale: string,
		t: { unknown: string; closed: string; open: (o: string, c: string) => string },
		clock: (x: string, l: string) => string
	) {
		const wd = new Date(Date.now() + 5.5 * 3600e3).getUTCDay(); // IST weekday, 0 = Sunday
		const r = rows.find((x) => x.weekday === wd);
		if (!r || r.hours_unknown) return t.unknown;
		if (!r.opens || !r.closes) return t.closed;
		return t.open(clock(r.opens, locale), clock(r.closes, locale));
	}
</script>

<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { clock, msg } from '#lib/msg.ts';

	let { rows }: { rows: HourRow[] } = $props();
	const locale = getLocale();
	const days = [1, 2, 3, 4, 5, 6, 0];
</script>

{#if !rows.length || rows.every((r) => r.hours_unknown)}
	<p class="type-body text-text-2">{m.hours_unknown()}</p>
{:else}
	<table class="w-full type-small">
		<tbody>
			{#each days as d (d)}
				{@const r = rows.find((x) => x.weekday === d)}
				<tr class="border-b border-border last:border-0">
					<th scope="row" class="py-1.5 pr-3 text-left font-normal text-text-2">{msg(`wd_${d}`)}</th
					>
					<td class="py-1.5">
						{#if !r || r.hours_unknown}{m.not_known()}{:else if !r.opens || !r.closes}{m.closed()}{:else}{clock(
								r.opens,
								locale
							)}–{clock(r.closes, locale)}{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
