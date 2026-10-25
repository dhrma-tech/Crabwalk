<script lang="ts" module>
	type F = {
		properties: {
			slug: string;
			max_safe: number | null;
			extremes: { time: string; height_m: number }[] | null;
		};
	};
	export type TideDay = {
		date: string;
		attribution: { text: string; url: string }[];
		f: F | null;
	};
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { tideState, heightAt } from '#lib/tides.ts';

	// FRONTEND §6.9 TideTimeSlider on the place page: drag through the day; accessible / cut off for this
	// spot from its safe-height rule; attribution next to the data. No rule or no data → "not known".
	// `preset` is for the component gallery only: no fetch, a fixed time.
	let {
		slug,
		lon,
		lat,
		preset
	}: {
		slug: string;
		lon: number;
		lat: number;
		preset?: { day: TideDay; minute: number };
	} = $props();
	// The preset applies in the server render too, so the gallery never shows the current time.
	const start = untrack(() => preset);
	let data = $state<TideDay | null>(start?.day ?? null);
	const now = new Date(Date.now() + 5.5 * 3600e3);
	let minute = $state(
		start?.minute ?? now.getUTCHours() * 60 + Math.floor(now.getUTCMinutes() / 15) * 15
	);

	$effect(() => {
		if (preset) return;
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

	// Report 2 §8: the day as a tide-height curve, safe windows shaded ok, cut-off windows danger. Drawn only
	// over the hours the extremes cover (no guessing past the first or last one).
	const samples = $derived.by(() => {
		if (!p?.extremes?.length || !data) return [];
		const out: { x: number; h: number; st: 'ok' | 'cut' | 'unknown' }[] = [];
		for (let x = 0; x <= 1440; x += 15) {
			const hx = heightAt(p.extremes, data.date, x);
			if (hx != null) out.push({ x, h: hx, st: tideState(p.extremes, p.max_safe, data.date, x) });
		}
		return out;
	});
	const curve = $derived.by(() => {
		if (samples.length < 2) return null;
		const hs = samples.map((s) => s.h);
		const lo = Math.min(...hs);
		const span = Math.max(...hs) - lo || 1;
		const y = (hx: number) => 66 - ((hx - lo) / span) * 54;
		const line = samples.map((s, i) => `${i ? 'L' : 'M'}${s.x} ${y(s.h).toFixed(1)}`).join('');
		// Runs of the same state become shaded bands.
		const bands: { from: number; to: number; st: 'ok' | 'cut' }[] = [];
		for (const s of samples) {
			const last = bands.at(-1);
			if (s.st === 'unknown') continue;
			if (last && last.st === s.st && last.to === s.x - 15) last.to = s.x;
			else bands.push({ from: s.x, to: s.x, st: s.st });
		}
		return { line, area: `${line}L${samples.at(-1)!.x} 72L${samples[0]!.x} 72Z`, bands };
	});
	const pct = $derived((minute / 1440) * 100);
</script>

<div class="flex flex-col gap-2" data-testid="place-tide-slider">
	{#if curve}
		<div class="relative h-8">
			<span
				class="absolute -translate-x-1/2 rounded-full bg-text px-2.5 py-0.5 type-label text-bg"
				style:left="clamp(28px, {pct}%, calc(100% - 28px))"
				aria-hidden="true">{hhmm(minute)}</span
			>
		</div>
		<div
			class="relative h-18 overflow-hidden rounded-md bg-surface-2 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
		>
			<svg
				viewBox="0 0 1440 72"
				preserveAspectRatio="none"
				class="absolute inset-0 size-full"
				aria-hidden="true"
			>
				{#each curve.bands as b (b.from)}
					<rect
						x={b.from}
						width={b.to - b.from + 15}
						y="0"
						height="72"
						fill={b.st === 'ok' ? 'var(--ok-50)' : 'var(--danger-50)'}
					/>
				{/each}
				<path d={curve.area} fill="var(--lagoon)" fill-opacity="0.2" />
				<path
					d={curve.line}
					fill="none"
					stroke="var(--lagoon)"
					stroke-width="2"
					vector-effect="non-scaling-stroke"
				/>
			</svg>
			<span
				class="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-text"
				style:left="{pct}%"
				aria-hidden="true"
			></span>
			<input
				type="range"
				min="0"
				max="1425"
				step="15"
				bind:value={minute}
				class="absolute inset-0 size-full cursor-ew-resize opacity-0"
				aria-label={m.tide_slider()}
				aria-valuetext={hhmm(minute)}
			/>
		</div>
	{:else}
		<label class="flex items-center gap-3 type-small">
			<span class="w-12 font-medium">{hhmm(minute)}</span>
			<input
				type="range"
				min="0"
				max="1425"
				step="15"
				bind:value={minute}
				class="flex-1 accent-[var(--lagoon)]"
				aria-label={m.tide_slider()}
			/>
		</label>
	{/if}
	<p class="flex items-center gap-2 type-body-strong" data-testid="tide-state" aria-live="polite">
		<span
			class={[
				'size-2 shrink-0 rounded-full',
				st === 'ok' ? 'bg-ok' : st === 'cut' ? 'bg-danger' : 'bg-muted'
			]}
			aria-hidden="true"
		></span>
		{hhmm(minute)} ·
		{st === 'ok'
			? m.tide_ok()
			: st === 'cut'
				? m.tide_cut()
				: m.tide_unknown()}{#if h != null}{` · ${h.toFixed(1)} m`}{/if}
	</p>
	{#each data?.attribution ?? [] as a (a.url)}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- provider attribution link -->
		<a href={a.url} target="_blank" rel="noopener" class="type-small">{a.text}</a>
	{/each}
</div>
