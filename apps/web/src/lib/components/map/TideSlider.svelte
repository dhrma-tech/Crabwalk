<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { tideState, heightAt } from '#lib/tides.ts';

	// FRONTEND §6.9 TideTimeSlider on the place page: drag through the day; accessible / cut off for this
	// spot from its safe-height rule; attribution next to the data. No rule or no data → "not known".
	let { slug, lon, lat }: { slug: string; lon: number; lat: number } = $props();
	type F = {
		properties: {
			slug: string;
			max_safe: number | null;
			extremes: { time: string; height_m: number }[] | null;
		};
	};
	let data = $state<{
		date: string;
		attribution: { text: string; url: string }[];
		f: F | null;
	} | null>(null);
	const now = new Date(Date.now() + 5.5 * 3600e3);
	let minute = $state(now.getUTCHours() * 60 + Math.floor(now.getUTCMinutes() / 15) * 15);

	$effect(() => {
		const d = 0.01;
		fetch(`/api/map/tides?bbox=${[lon - d, lat - d, lon + d, lat + d].join(',')}`)
			.then((r) =>
				r.ok
					? (r.json() as Promise<{
							date: string;
							attribution: { text: string; url: string }[];
							features: F[];
						}>)
					: null
			)
			.then((r) => {
				data = r
					? {
							date: r.date,
							attribution: r.attribution,
							f: r.features.find((x) => x.properties.slug === slug) ?? null
						}
					: null;
			})
			.catch(() => (data = null));
	});
	const p = $derived(data?.f?.properties);
	const st = $derived(p && data ? tideState(p.extremes, p.max_safe, data.date, minute) : 'unknown');
	const h = $derived(p?.extremes && data ? heightAt(p.extremes, data.date, minute) : null);
	const hhmm = (x: number) =>
		`${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
</script>

<div
	class="flex flex-col gap-2 rounded-card border border-border bg-surface p-3"
	data-testid="place-tide-slider"
>
	<label class="flex items-center gap-3 type-small">
		<span class="w-12 font-semibold" aria-live="polite">{hhmm(minute)}</span>
		<input
			type="range"
			min="0"
			max="1425"
			step="15"
			bind:value={minute}
			class="flex-1"
			aria-label={m.tide_slider()}
		/>
	</label>
	<p
		class={[
			'type-body font-semibold',
			st === 'ok' ? 'text-ok' : st === 'cut' ? 'text-danger' : 'text-text-2'
		]}
		data-testid="tide-state"
	>
		{st === 'ok' ? m.tide_ok() : st === 'cut' ? m.tide_cut() : m.tide_unknown()}{#if h != null}
			· {h.toFixed(1)} m{/if}
	</p>
	{#each data?.attribution ?? [] as a (a.url)}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- provider attribution link -->
		<a href={a.url} target="_blank" rel="noopener" class="type-small">{a.text}</a>
	{/each}
</div>
