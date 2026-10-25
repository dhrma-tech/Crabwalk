<script lang="ts" module>
	export type PriceRow = { label: string; price: string | null; source: string; href?: string };
</script>

<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';

	// FRONTEND §7.5: every price row shows its source (§13). Links open the provider; we never take payments.
	// Tideline: rows on one surface card with hairlines (inset list).
	let { rows }: { rows: PriceRow[] } = $props();
</script>

{#if !rows.length}
	<p class="type-body text-text-2">{m.price_none()}</p>
{:else}
	<div class="overflow-hidden rounded-lg bg-surface shadow-e1">
		<table class="w-full" data-testid="price-table">
			<tbody class="divide-y divide-border">
				{#each rows as r, i (i)}
					<tr>
						<td class="py-3 pr-3 pl-4">
							<p class="type-h3">{r.label}</p>
							<p class="type-small text-text-2" data-testid="price-source">
								{m.source_label({ source: r.source })}
							</p>
						</td>
						<td class="py-3 pr-4 text-right type-body-strong whitespace-nowrap">
							{#if r.href}
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external booking link -->
								<a href={r.href} target="_blank" rel="noopener sponsored"
									>{r.price ?? m.price_see()}</a
								>
							{:else}
								{r.price ?? ''}
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
