<script lang="ts">
	import Phone from '@lucide/svelte/icons/phone';
	import Navigation from '@lucide/svelte/icons/navigation';
	import Share2 from '@lucide/svelte/icons/share-2';
	import X from '@lucide/svelte/icons/x';
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

<div class="fixed inset-0 z-50 flex items-end bg-black/40" role="presentation">
	<div
		role="alertdialog"
		aria-modal="true"
		aria-labelledby="emergency-title"
		class="w-full overflow-hidden rounded-t-sheet bg-raised pb-[env(safe-area-inset-bottom)] shadow-float"
		data-testid="emergency-card"
	>
		<header class="flex items-center justify-between bg-emergency px-4 py-3 text-white">
			<h2 id="emergency-title" class="type-h2">{m.emergency_title()}</h2>
			<button
				type="button"
				class="flex size-11 items-center justify-center"
				aria-label={m.close()}
				onclick={onclose}
			>
				<X size={24} aria-hidden="true" />
			</button>
		</header>
		<div class="flex flex-col gap-4 p-4">
			<a
				href="tel:112"
				class="flex min-h-16 items-center justify-center gap-3 rounded-chip bg-emergency type-h1 text-white no-underline"
				><Phone size={28} aria-hidden="true" />{m.qr_call_112()}</a
			>

			<div
				class="flex flex-col gap-2 rounded-card border border-border bg-surface p-3"
				aria-live="polite"
			>
				<h3 class="type-h3">{m.emergency_hospital()}</h3>
				{#if status === 'locating'}
					<p class="type-small text-text-2">{m.emergency_locating()}</p>
				{:else if status === 'no-gps'}
					<p class="type-small">{m.qr_gps_off()}</p>
				{:else if status === 'none' || !hospital}
					<p class="type-small">{m.emergency_no_hospital()}</p>
				{:else}
					<p class="type-body">
						{hospital.name ?? m.util_hospital()} · {m.km_away({
							km: formatNumber(Math.round(hospital.km * 10) / 10)
						})}
					</p>
					<div class="flex flex-wrap gap-2">
						{#if hospital.phone}
							<a
								href="tel:{hospital.phone}"
								class="flex min-h-11 items-center gap-2 rounded-chip border border-border px-4 type-small no-underline"
								><Phone size={18} aria-hidden="true" />{m.emergency_call_hospital()}</a
							>
						{/if}
						<a
							href="https://www.google.com/maps/dir/?api=1&destination={hospital.lat},{hospital.lon}"
							target="_blank"
							rel="noopener"
							class="flex min-h-11 items-center gap-2 rounded-chip border border-border px-4 type-small no-underline"
							><Navigation size={18} aria-hidden="true" />{m.emergency_navigate()}</a
						>
					</div>
				{/if}
			</div>

			<button
				type="button"
				disabled={!pos}
				onclick={share}
				class="flex min-h-12 items-center justify-center gap-2 rounded-chip border-2 border-emergency type-h3 text-text disabled:opacity-50"
				><Share2 size={20} aria-hidden="true" />{m.qr_share_location()}</button
			>
		</div>
	</div>
</div>
