<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';

	// Ready-made itineraries (team) first, then approved community routes.
	let {
		items
	}: {
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

<ul class="flex flex-col gap-3" data-testid="itineraries-list">
	{#each items as it (it.id)}
		<li>
			<!-- eslint-disable svelte/no-navigation-without-resolve -- href built server-side from a known route + slug -->
			<a
				href={it.href}
				class="flex flex-col gap-1 rounded-card border border-border bg-surface p-4 text-text no-underline"
			>
				<span class="type-h3">{it.title}</span>
				<span class="type-small text-text-2">
					{m.plan_n_days({ n: it.days })} · {m.itin_places({ n: it.places })} · {it.readyMade
						? m.itin_ready_made()
						: m.itin_community()}
				</span>
				{#if it.highlights.length}<span class="type-small">{it.highlights.join(' · ')}</span>{/if}
			</a>
		</li>
	{/each}
</ul>
