<script lang="ts">
	import Volume2 from '@lucide/svelte/icons/volume-2';
	import VolumeX from '@lucide/svelte/icons/volume-x';
	import Sun from '@lucide/svelte/icons/sun';
	import CornerUpLeft from '@lucide/svelte/icons/corner-up-left';
	import CornerUpRight from '@lucide/svelte/icons/corner-up-right';
	import RotateCw from '@lucide/svelte/icons/rotate-cw';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Navigation from '@lucide/svelte/icons/navigation';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Moon from '@lucide/svelte/icons/moon';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { PMTILES_BASE_URL } from '$app/env/public';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { formatNumber } from '#lib/format.ts';
	import TopBar from '#lib/components/TopBar.svelte';
	import Button from '#lib/components/Button.svelte';
	import ErrorState from '#lib/components/ErrorState.svelte';
	import MapView from '#lib/components/map/MapView.svelte';
	import {
		cumulative,
		decodePolyline,
		decodeTurns,
		navState,
		type LL,
		type NavState
	} from '#lib/nav/nav.ts';
	import { isNight } from '#lib/sun.ts';
	import Meta from '#lib/components/Meta.svelte';

	// FRONTEND §7.12: map + route line + big next-turn card + voice toggle + wake-lock indicator + limits notice
	// + "Open in Google Maps" for long highway drives. Planned legs use the stored route + turn cues (offline);
	// other destinations use Ola Directions when signed in and online (B11), else the Google Maps hand-off.
	type Leg = {
		from: { name: string; at: LL | null };
		to: { name: string; at: LL; href: string | null };
		shape: string | null;
		turns: string | null;
		distance_m: number | null;
		duration_s: number | null;
	};
	const q = page.url.searchParams;
	let legs = $state<Leg[]>([]);
	let idx = $state(Number(q.get('leg') ?? 0));
	let me = $state<LL | null>(null);
	let voice = $state(false);
	let awake = $state(false);
	// FRONTEND §12: suggest dark mode for night driving (after sunset, if not already dark).
	let darkDismissed = $state(false);
	const darkNow = () =>
		document.documentElement.dataset.theme === 'dark' ||
		(!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
	const suggestDark = $derived(
		!darkDismissed && !!me && isNight(new Date(), me[0], me[1]) && !darkNow()
	);
	let failed = $state(false);
	let olaLine = $state<LL[] | null>(null);
	// Announcement keys already spoken — not UI state, so a plain Set.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	let spoken = new Set<string>();

	const leg = $derived(legs[idx]);
	const line = $derived(leg?.shape ? decodePolyline(leg.shape) : olaLine);
	const cum = $derived(line ? cumulative(line) : []);
	const turns = $derived(decodeTurns(leg?.turns ?? null));
	const guide = $derived(
		!line && leg?.to ? ([me ?? leg.from.at, leg.to.at].filter(Boolean) as LL[]) : null
	);
	const nav = $derived<NavState | null>(
		line && me ? navState(line, cum, turns, me, leg?.duration_s ?? null) : null
	);
	const straightKm = $derived(
		me && leg ? Math.hypot((leg.to.at[0] - me[0]) * 106, (leg.to.at[1] - me[1]) * 110.6) : null
	);
	const arrived = $derived(
		(nav && nav.left < 40) || (!line && straightKm != null && straightKm < 0.05)
	);
	const gmaps = $derived(
		leg
			? `https://www.google.com/maps/dir/?api=1&destination=${leg.to.at[1]},${leg.to.at[0]}&travelmode=driving`
			: ''
	);
	// Long drives (no stored shape = > 60 km, or the first leg from a station): Google Maps is the better tool.
	const longDrive = $derived(
		!!leg && !leg.shape && (leg.distance_m == null || leg.distance_m > 60_000)
	);

	const turnText = (code: string) =>
		code.startsWith('O')
			? code.length > 1
				? m.turn_roundabout_exit({ n: code.slice(1) })
				: m.turn_roundabout()
			: ((
					{
						L: m.turn_left(),
						R: m.turn_right(),
						SL: m.turn_slight_left(),
						SR: m.turn_slight_right(),
						HL: m.turn_sharp_left(),
						HR: m.turn_sharp_right(),
						U: m.turn_uturn()
					} as Record<string, string>
				)[code] ?? m.turn_continue());
	const dist = (mtr: number) =>
		mtr < 1000
			? m.nav_m({ n: Math.round(mtr / 10) * 10 })
			: m.nav_km({ n: formatNumber(Math.round(mtr / 100) / 10) });

	function say(text: string, key: string) {
		if (!voice || spoken.has(key) || !('speechSynthesis' in window)) return;
		spoken.add(key);
		const u = new SpeechSynthesisUtterance(text);
		u.lang = `${getLocale()}-IN`;
		speechSynthesis.speak(u);
	}
	$effect(() => {
		if (!nav?.next) return;
		for (const at of [400, 100])
			if (nav.next.in <= at)
				say(
					`${turnText(nav.next.code)} ${m.nav_in()} ${dist(nav.next.in)}`,
					`${idx}:${nav.along.toFixed(0).slice(0, -2)}:${at}:${nav.next.code}`
				);
	});
	$effect(() => {
		if (arrived && leg) say(m.nav_arrived({ place: leg.to.name }), `arrive:${idx}`);
	});

	// Screen wake lock while navigating (re-taken when the page becomes visible again).
	let lock: { release: () => Promise<void> } | null = null;
	async function wake() {
		try {
			lock =
				(await (
					navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<typeof lock> } }
				).wakeLock?.request('screen')) ?? null;
			awake = !!lock;
		} catch {
			awake = false;
		}
	}

	onMount(() => {
		const trip = q.get('trip');
		const day = Number(q.get('day') ?? 1);
		const to = q.get('to')?.split(',').map(Number);
		(async () => {
			if (trip) {
				// The service worker keeps the last copy, so this works offline for saved trips.
				const res = await fetch(`/api/trips/${trip}/routes`).catch(() => null);
				const r = res?.ok ? ((await res.json()) as { days: { day: number; legs: Leg[] }[] }) : null;
				legs = r?.days.find((d) => d.day === day)?.legs ?? [];
				if (!legs.length) failed = true;
			} else if (to?.length === 2 && to.every(Number.isFinite)) {
				legs = [
					{
						from: { name: '', at: null },
						to: { name: q.get('name') ?? '', at: [to[1]!, to[0]!], href: null },
						shape: null,
						turns: null,
						distance_m: null,
						duration_s: null
					}
				];
			} else failed = true;
		})();
		const watch = navigator.geolocation?.watchPosition(
			(p) => (me = [p.coords.longitude, p.coords.latitude]),
			() => {},
			{ enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
		);
		wake();
		const vis = () => document.visibilityState === 'visible' && wake();
		document.addEventListener('visibilitychange', vis);
		return () => {
			if (watch != null) navigator.geolocation.clearWatch(watch);
			document.removeEventListener('visibilitychange', vis);
			lock?.release();
		};
	});

	// Non-DB destination: Ola Directions (signed-in, online; display only, never stored — BACKEND §6.1).
	$effect(() => {
		if (!leg || leg.shape || olaLine || !me || q.get('trip') || !navigator.onLine) return;
		const from = `${me[1]},${me[0]}`;
		fetch(`/ola/directions?from=${from}&to=${leg.to.at[1]},${leg.to.at[0]}`)
			.then((r) => (r.ok ? (r.json() as Promise<{ route?: { polyline: string } | null }>) : null))
			.then((r) => {
				if (r?.route?.polyline) olaLine = decodePolyline(r.route.polyline);
			})
			.catch(() => {});
	});
</script>

<Meta title={m.nav_title()} />
<TopBar title={m.nav_title()} back />
<main id="main" class="relative min-h-0 flex-1">
	<h1 class="sr-only">{m.nav_title()}</h1>
	{#if failed || !PMTILES_BASE_URL}
		<ErrorState title={m.error_title()} body={m.nav_unavailable()} />
	{:else}
		<div class="absolute inset-0">
			<MapView
				tilesBase={PMTILES_BASE_URL.replace(/\/$/, '')}
				showPins={false}
				route={line}
				{guide}
				{me}
				follow={!!me}
				onselect={() => {}}
				onerror={() => (failed = true)}
			/>
		</div>

		<!-- Tideline (Report 2 §9.10, T-35): ink next-turn card on top; a solid bottom bar with ETA, voice, wake lock and
		     Google Maps. Solid, not glass: both hold text over the map (Report 2 §11). The phone nav is hidden here. -->
		<div class="absolute inset-x-3 top-3 z-map-ui mx-auto max-w-140" data-testid="nav-card">
			{#if leg}
				{@const Icon = arrived
					? MapPin
					: nav?.offRoute
						? TriangleAlert
						: !nav?.next
							? Navigation
							: nav.next.code.startsWith('O')
								? RotateCw
								: nav.next.code === 'U'
									? Undo2
									: nav.next.code.endsWith('L')
										? CornerUpLeft
										: CornerUpRight}
				<div class="flex items-center gap-4 rounded-xl bg-text p-4 text-bg shadow-e3">
					<span
						class="flex size-16 shrink-0 items-center justify-center rounded-lg bg-bg/15"
						aria-hidden="true"><Icon size={40} strokeWidth={2.25} /></span
					>
					<div class="min-w-0 flex-1">
						{#if arrived}
							<p class="type-h2 break-words" data-testid="nav-arrived">
								{m.nav_arrived({ place: leg.to.name })}
							</p>
						{:else if nav?.offRoute}
							<p class="type-h2" role="alert">{m.nav_off_route()}</p>
						{:else if nav?.next}
							<p class="type-display tabular-nums">{dist(nav.next.in)}</p>
							<p class="type-h3 break-words" data-testid="nav-next">{turnText(nav.next.code)}</p>
						{:else}
							<p class="type-h2 break-words">{m.nav_head_to({ place: leg.to.name })}</p>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<div
			class="absolute inset-x-0 bottom-[calc(--spacing(3)+env(safe-area-inset-bottom))] z-map-ui mx-auto flex max-h-[calc(100%-9.5rem)] max-w-146 flex-col gap-2 overflow-y-auto px-3 pt-3"
		>
			<!-- Capped under the turn card (open steps scroll instead of covering it); px/pt keep the shadows unclipped. -->
			{#if suggestDark}
				<form
					method="POST"
					action="/prefs"
					class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-surface p-3 shadow-e2"
					data-testid="dark-suggest"
				>
					<input type="hidden" name="theme" value="dark" />
					<input type="hidden" name="return" value={page.url.pathname + page.url.search} />
					<p class="flex min-w-0 flex-[1_1_15rem] items-center gap-2 type-small text-text">
						<Moon size={18} class="shrink-0 text-text-2" aria-hidden="true" />{m.nav_dark_hint()}
					</p>
					<div class="flex items-center gap-2">
						<Button type="submit" variant="outline">{m.nav_dark_on()}</Button>
						<Button type="button" variant="ghost" onclick={() => (darkDismissed = true)}
							>{m.nav_dark_no()}</Button
						>
					</div>
				</form>
			{/if}
			<div class="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-e3">
				{#if leg}
					<div class="flex items-center gap-3">
						<p class="min-w-0 flex-1 type-body-strong tabular-nums" data-testid="nav-left">
							{#if nav}{nav.etaMin != null
									? `${m.nav_left({ d: dist(nav.left) })} · ${m.nav_eta({ n: nav.etaMin })}`
									: m.nav_left({ d: dist(nav.left) })}
							{:else if straightKm != null}{m.nav_straight({
									d: dist(straightKm * 1000)
								})}{:else}{m.emergency_locating()}{/if}
						</p>
						<button
							type="button"
							class={[
								'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 type-label transition-colors duration-200',
								voice ? 'bg-text text-bg' : 'bg-surface-2 text-text hover:bg-surface-3'
							]}
							aria-pressed={voice}
							onclick={() => (voice = !voice)}
						>
							{#if voice}<Volume2 size={18} aria-hidden="true" />{:else}<VolumeX
									size={18}
									aria-hidden="true"
								/>{/if}{m.nav_voice()}
						</button>
					</div>
					<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
						<span
							class="inline-flex min-h-9 items-center gap-2 type-label text-text-2"
							data-testid="wake-lock"
						>
							<span
								class={['size-2.5 rounded-full', awake ? 'bg-ok' : 'bg-border-strong']}
								aria-hidden="true"
							></span>
							<Sun size={16} aria-hidden="true" />{awake ? m.nav_awake_on() : m.nav_awake_off()}
						</span>
						{#if olaLine && !leg.shape}
							<!-- BACKEND §6.1: Ola results are attributed wherever they show. -->
							<p class="type-label text-text-2" data-testid="ola-attribution">
								{m.nav_route_by()}
								<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener"
									>Ola Maps</a
								>
							</p>
						{/if}
					</div>
					{#if longDrive}<p class="rounded-md bg-surface-2 px-3 py-2 type-small text-text">
							{m.nav_long_drive()}
						</p>{/if}
					<div class="flex flex-wrap gap-2 [&>*]:flex-1">
						<Button
							variant={longDrive && !(arrived && idx < legs.length - 1) ? 'primary' : 'outline'}
							href={gmaps}
						>
							{#snippet icon()}<ExternalLink size={18} aria-hidden="true" />{/snippet}
							{m.map_open_gmaps()}
						</Button>
						{#if arrived && idx < legs.length - 1}
							<Button onclick={() => ((idx += 1), (spoken = new Set()))}
								>{m.nav_next_stop({ place: legs[idx + 1]!.to.name })}</Button
							>
						{/if}
					</div>
					{#if turns.length}
						<details class="group border-t border-border pt-1" data-testid="nav-steps">
							<summary
								class="flex min-h-11 cursor-pointer list-none items-center justify-between type-label text-text-2"
								>{m.nav_steps({ n: turns.length })}<ChevronDown
									size={18}
									class="transition-transform duration-200 group-open:rotate-180"
									aria-hidden="true"
								/></summary
							>
							<ol class="flex max-h-40 flex-col overflow-y-auto pb-1">
								{#each turns as t, i (i)}
									<li
										class="flex justify-between gap-3 border-b border-border py-2 type-small last:border-0"
									>
										<span>{turnText(t.code)}</span><span class="text-text-2 tabular-nums"
											>{dist(cum[t.at] ?? 0)}</span
										>
									</li>
								{/each}
							</ol>
						</details>
					{/if}
				{/if}
				<p class="type-small text-text-2">{m.nav_limits()}</p>
			</div>
		</div>
	{/if}
</main>
