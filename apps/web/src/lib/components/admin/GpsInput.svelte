<script lang="ts">
	import LocateFixed from '@lucide/svelte/icons/locate-fixed';
	import { PMTILES_BASE_URL } from '$app/env/public';
	import Button from '../Button.svelte';

	// GPS for the admin editor: latitude / longitude (6 decimals), "Use my location", and a map pin you drag or
	// tap to move (own PMTiles only). Clearing both = Unknown (null).
	type Gps = { lat: number; lng: number } | null;
	let {
		value = $bindable(),
		error = null,
		missing = false
	}: { value: unknown; error?: string | null; missing?: boolean } = $props();

	const g = $derived(value as Gps);
	const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
	let loc = $state<'idle' | 'busy' | 'denied' | 'failed'>('idle');
	let showMap = $state(false);
	const input = 'min-h-12 w-full rounded-md border bg-surface px-3 type-body text-text';
	const border = $derived(
		error ? 'border-danger' : missing ? 'border-alphonso border-2' : 'border-border-strong'
	);

	function set(lat: number | null, lng: number | null) {
		value = lat == null && lng == null ? null : { lat: lat as number, lng: lng as number };
	}
	const num = (s: string) => (s.trim() === '' ? null : Number(s));

	function locate() {
		if (!navigator.geolocation) return (loc = 'failed');
		loc = 'busy';
		navigator.geolocation.getCurrentPosition(
			(p) => {
				set(r6(p.coords.latitude), r6(p.coords.longitude));
				loc = 'idle';
			},
			(e) => (loc = e.code === e.PERMISSION_DENIED ? 'denied' : 'failed'),
			{ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
		);
	}
	const pick = ([lon, lat]: [number, number]) => set(r6(lat), r6(lon));
</script>

<div class="flex flex-col gap-2">
	<div class="grid grid-cols-2 gap-2">
		<label class="flex flex-col gap-1 type-small text-text-2"
			>Latitude<input
				type="number"
				step="0.000001"
				inputmode="decimal"
				class={[input, border]}
				value={g?.lat ?? ''}
				aria-invalid={!!error}
				onchange={(e) => set(num(e.currentTarget.value), g?.lng ?? null)}
			/></label
		>
		<label class="flex flex-col gap-1 type-small text-text-2"
			>Longitude<input
				type="number"
				step="0.000001"
				inputmode="decimal"
				class={[input, border]}
				value={g?.lng ?? ''}
				aria-invalid={!!error}
				onchange={(e) => set(g?.lat ?? null, num(e.currentTarget.value))}
			/></label
		>
	</div>
	<div class="flex flex-wrap gap-2">
		<Button variant="secondary" onclick={locate} loading={loc === 'busy'}
			>{#snippet icon()}<LocateFixed size={20} aria-hidden="true" />{/snippet}Use my location</Button
		>
		{#if PMTILES_BASE_URL}
			<Button variant="outline" onclick={() => (showMap = !showMap)}
				>{showMap ? 'Hide map' : 'Pin on map'}</Button
			>
		{/if}
		{#if g}<Button variant="ghost" onclick={() => set(null, null)}>Clear (Unknown)</Button>{/if}
	</div>
	{#if loc === 'denied'}<p class="type-small text-danger" role="alert">
			Location permission is off. Allow it in the browser, or drag the pin on the map.
		</p>{:else if loc === 'failed'}<p class="type-small text-danger" role="alert">
			Couldn't get a location fix. Try again outside, or use the map.
		</p>{/if}
	{#if showMap && PMTILES_BASE_URL}
		{#await import('../map/MapView.svelte') then { default: MapView }}
			<div class="h-72 overflow-hidden rounded-md" data-testid="gps-map">
				<MapView
					tilesBase={PMTILES_BASE_URL.replace(/\/$/, '')}
					showPins={false}
					initial={g ? { lon: g.lng, lat: g.lat } : null}
					dragPin={g ? [g.lng, g.lat] : null}
					ondragpin={pick}
					onpick={pick}
					onselect={() => {}}
					onerror={() => {}}
				/>
			</div>
			<p class="type-small text-text-2">Drag the pin, or tap the map to move it.</p>
		{/await}
	{/if}
</div>
