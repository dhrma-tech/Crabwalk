<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { formatINR } from '#lib/format.ts';

	// Ready-made itineraries (team) first, then approved community routes. `cards` = Discover's wide cards
	// (Report 2 §9.1): a mini route line (one dot per place stop, a gap between days), days, budget.
	let {
		items,
		cards = false
	}: {
		cards?: boolean;
		items: {
			id: string;
			href: string;
			title: string;
			days: number;
			readyMade: boolean;
			places: number;
			perDay?: number[];
			budget?: number | null;
			highlights: string[];
		}[];
	} = $props();
</script>

<ul
	class={cards ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5' : 'flex flex-col'}
	data-testid="itineraries-list"
>
	{#each items as it (it.id)}
		<li>
			<!-- eslint-disable svelte/no-navigation-without-resolve -- href built server-side from a known route + slug -->
			<a
				href={it.href}
				class={[
					'flex text-text no-underline',
					cards
						? 'h-full flex-col gap-3 rounded-lg bg-surface p-4 shadow-e1 transition-shadow duration-300 ease-brand hover:shadow-e2'
						: 'row-link flex-col gap-0.5 border-t border-border py-3'
				]}
			>
				{#if cards && it.perDay?.some((n) => n)}
					<div class="flex items-center gap-3" aria-hidden="true">
						{#each it.perDay as n, d (d)}
							{#if n}
								<span class="flex flex-1 items-center">
									{#each { length: n }, i (i)}
										{#if i}<span class="h-0.5 flex-1 bg-lagoon-100"></span>{/if}
										<span class="size-2.5 shrink-0 rounded-full border-2 border-lagoon bg-surface"
										></span>
									{/each}
								</span>
							{/if}
						{/each}
					</div>
				{/if}
				<span class="type-h3">{it.title}</span>
				<span class="type-small text-text-2">
					{[
						m.plan_n_days({ n: it.days }),
						m.itin_places({ n: it.places }),
						cards && it.budget && m.itin_budget({ amount: formatINR(it.budget) }),
						it.readyMade ? m.itin_ready_made() : m.itin_community()
					]
						.filter(Boolean)
						.join(' · ')}
				</span>
				{#if it.highlights.length}<span class="type-small text-text-2"
						>{it.highlights.join(' · ')}</span
					>{/if}
			</a>
		</li>
	{/each}
</ul>
