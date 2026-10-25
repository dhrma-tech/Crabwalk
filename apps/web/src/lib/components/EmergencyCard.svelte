<script lang="ts">
	import Phone from '@lucide/svelte/icons/phone';
	import Navigation from '@lucide/svelte/icons/navigation';
	import Share2 from '@lucide/svelte/icons/share-2';
	import { m } from '#lib/paraglide/messages.js';
	import { formatNumber } from '#lib/format.ts';
	import { offlineData } from '#lib/packs.ts';

	// FRONTEND §6.8 [LOCKED]: --emergency header, huge Call 112, nearest hospital (distance + call +
	// navigate), share live location. No branding, no mascot, no bounce. The position stays on the device.
	// Offline hospital lists per taluka arrive with the taluka packs (P9); until then the last fetched list
	// is served by the service worker cache.
	let { onclose }: { onclose: () => void } = $props();

	type Hospital = {
		name: string | null;
		phone: string | null;
		lon: number;
		lat: number;
		km: number;
	};
	let pos = $state<{ lon: number; lat: number } | null>(null);
	let hospital = $state<Hospital | null>(null);
	let status = $state<'locating' | 'ready' | 'no-gps' | 'none'>('locating');

	const km = (a: { lon: number; lat: number }, b: { lon: number; lat: number }) =>
		Math.hypot(
			(b.lon - a.lon) * 111.32 * Math.cos((a.lat * Math.PI) / 180),
			(b.lat - a.lat) * 110.57
		);

	$effect(() => {
		if (!navigator.geolocation) return void (status = 'no-gps');
		navigator.geolocation.getCurrentPosition(
			async (p) => {
				const here = { lon: p.coords.longitude, lat: p.coords.latitude };
				pos = here;
				const d = 0.3;
				const bbox = [here.lon - d, here.lat - d, here.lon + d, here.lat + d].join(',');
				const res = await fetch(`/api/map/utilities?bbox=${bbox}&types=hospital`).catch(() => null);
				// Offline: hospitals from downloaded taluka packs (FRONTEND §9).
				const fc = res?.ok
					? ((await res.json()) as {
							features: {
								geometry: { coordinates: [number, number] };
								properties: { name: string | null; phone: string | null };
							}[];
						})
					: {
							features: (await offlineData()).utilities
								.filter((u) => u.type === 'hospital')
								.map((u) => ({
									geometry: { coordinates: u.at },
									properties: { name: u.name, phone: u.phone }
								}))
						};
				const list = fc.features
					.map((f) => {
						const [lon, lat] = f.geometry.coordinates;
						return {
							name: f.properties.name,
							phone: f.properties.phone,
							lon,
							lat,
							km: km(here, { lon, lat })
						};
					})
					.sort((a, b) => a.km - b.km);
				hospital = list[0] ?? null;
				status = hospital ? 'ready' : 'none';
			},
			() => (status = 'no-gps'),
			{ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
		);
	});

	function share() {
		if (!pos) return;
		const text = `${m.emergency_share_text()} https://maps.google.com/?q=${pos.lat.toFixed(5)},${pos.lon.toFixed(5)}`;
		if (navigator.share) navigator.share({ text }).catch(() => {});
		else location.href = `sms:?&body=${encodeURIComponent(text)}`;
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- Full-screen sheet over anything; the red header is the 112 call itself (system font, bold). Calm: no motion,
     no mascot. -->
<div
	role="alertdialog"
	aria-modal="true"
	aria-labelledby="emergency-title"
	class="fixed inset-0 z-overlay overflow-y-auto bg-bg pb-[env(safe-area-inset-bottom)] text-text"
	data-testid="emergency-card"
>
	<a
		href="tel:112"
		class="block bg-emergency px-6 pt-[calc(36px+env(safe-area-inset-top))] pb-8 text-white no-underline"
	>
		<h2 id="emergency-title" class="type-small">{m.emergency_title()}</h2>
		<span class="flex items-center gap-3 [font:700_56px/1.15_system-ui,sans-serif]"
			><Phone size={40} aria-hidden="true" />{m.qr_call_112()}</span
		>
	</a>
	<div class="mx-auto flex max-w-[680px] flex-col gap-5 p-6">
		<div class="flex flex-col gap-1" aria-live="polite">
			<h3 class="type-small text-text-2">{m.emergency_hospital()}</h3>
			{#if status === 'locating'}
				<p class="type-small text-text-2">{m.emergency_locating()}</p>
			{:else if status === 'no-gps'}
				<p class="type-small">{m.qr_gps_off()}</p>
			{:else if status === 'none' || !hospital}
				<p class="type-small">{m.emergency_no_hospital()}</p>
			{:else}
				<p class="type-h2">{hospital.name ?? m.util_hospital()}</p>
				<p class="text-text-2">
					{m.km_away({ km: formatNumber(Math.round(hospital.km * 10) / 10) })}
				</p>
				<div class="mt-3 grid grid-cols-2 gap-2.5">
					{#if hospital.phone}
						<a
							href="tel:{hospital.phone}"
							class="flex min-h-12 items-center justify-center gap-2 rounded-md bg-text px-3 type-body-strong text-bg no-underline"
							><Phone size={18} aria-hidden="true" />{m.emergency_call_hospital()}</a
						>
					{/if}
					<a
						href="https://www.google.com/maps/dir/?api=1&destination={hospital.lat},{hospital.lon}"
						target="_blank"
						rel="noopener"
						class={[
							'flex min-h-12 items-center justify-center gap-2 rounded-md border-[1.5px] border-border-strong px-3 type-body-strong text-text no-underline',
							!hospital.phone && 'col-span-2'
						]}><Navigation size={18} aria-hidden="true" />{m.emergency_navigate()}</a
					>
				</div>
			{/if}
		</div>

		<div class="flex flex-col gap-1.5 border-t border-border pt-4">
			<button
				type="button"
				disabled={!pos}
				onclick={share}
				class="flex min-h-12 items-center justify-center gap-2 rounded-md border-[1.5px] border-border-strong type-body-strong text-text disabled:text-muted"
				><Share2 size={20} aria-hidden="true" />{m.qr_share_location()}</button
			>
		</div>

		<button
			type="button"
			class="min-h-11 text-text-2 underline underline-offset-4"
			onclick={onclose}>{m.close()}</button
		>
	</div>
</div>
