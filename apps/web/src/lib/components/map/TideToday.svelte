<script lang="ts">
	import Waves from '@lucide/svelte/icons/waves';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import type { TideDay } from '#lib/tides.ts';

	// Today's extremes for a station, attribution right next to the data (TideCheck terms, BACKEND §8).
	let { station }: { station: string } = $props();
	let day = $state<TideDay | null | undefined>(undefined);

	$effect(() => {
		day = undefined;
		fetch(`/api/tides/${station}`)
			.then((r) => (r.ok ? (r.json() as Promise<TideDay>) : null))
			.then((d) => (day = d))
			.catch(() => (day = null));
	});

	const time = (iso: string) =>
		new Intl.DateTimeFormat(`${getLocale()}-IN`, {
			hour: 'numeric',
			minute: '2-digit',
			timeZone: 'Asia/Kolkata'
		}).format(new Date(iso));
</script>

<section class="flex flex-col gap-2 border-t border-border pt-3" data-testid="tides">
	<h3 class="flex items-center gap-1.5 type-h3">
		<Waves size={20} aria-hidden="true" />{m.map_tides()}
	</h3>
	{#if day === undefined}
		<div class="h-5 w-2/3 bg-border" aria-hidden="true"></div>
	{:else if day === null || !day.extremes.length}
		<p class="type-small text-text-2">{m.tide_unavailable()}</p>
	{:else}
		<ul class="flex flex-wrap gap-x-4 gap-y-1 type-small">
			{#each day.extremes as e (e.time)}
				<li>
					{e.type === 'high' ? m.tide_high() : m.tide_low()} · {time(e.time)} · {e.height_m.toFixed(
						1
					)} m
				</li>
			{/each}
		</ul>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external provider link -->
		<a href={day.attribution.url} target="_blank" rel="noopener" class="type-small"
			>{day.attribution.text}</a
		>
	{/if}
</section>
