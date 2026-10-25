<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';

	// Ready-made itineraries (team) first, then approved community routes. `cards` = hairline card grid (Discover).
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
			highlights: string[];
		}[];
	} = $props();
</script>

<ul
	class={cards ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-col'}
	data-testid="itineraries-list"
>
	{#each items as it (it.id)}
		<li>
			<!-- eslint-disable svelte/no-navigation-without-resolve -- href built server-side from a known route + slug -->
			<a
				href={it.href}
				class={[
					'row-link flex flex-col gap-0.5 text-text no-underline',
					cards ? 'h-full border border-border p-4' : 'border-t border-border py-3'
				]}
			>
				<span class="type-h3">{it.title}</span>
				<span class="text-[13px] text-text-2">
					{m.plan_n_days({ n: it.days })} · {m.itin_places({ n: it.places })} · {it.readyMade
						? m.itin_ready_made()
						: m.itin_community()}
				</span>
				{#if it.highlights.length}<span class="type-small">{it.highlights.join(' · ')}</span>{/if}
			</a>
		</li>
	{/each}
</ul>
