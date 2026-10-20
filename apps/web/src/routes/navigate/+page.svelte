<script lang="ts">
	import Volume2 from '@lucide/svelte/icons/volume-2';
	import VolumeX from '@lucide/svelte/icons/volume-x';
	import Sun from '@lucide/svelte/icons/sun';
	import CornerUpLeft from '@lucide/svelte/icons/corner-up-left';
	import CornerUpRight from '@lucide/svelte/icons/corner-up-right';
	import RotateCw from '@lucide/svelte/icons/rotate-cw';
	import Undo2 from '@lucide/svelte/icons/undo-2';
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

		<div
			class="absolute inset-x-3 top-3 z-10 mx-auto flex max-w-[560px] flex-col gap-2"
			data-testid="nav-card"
		>
			{#if leg}
				<div class="bg-text p-4 text-bg">
					{#if arrived}
						<p class="font-display text-[24px] leading-snug" data-testid="nav-arrived">
							{m.nav_arrived({ place: leg.to.name })}
						</p>
					{:else if nav?.offRoute}
						<p class="type-h2" role="alert">{m.nav_off_route()}</p>
					{:else if nav?.next}
						{@const Icon = nav.next.code.startsWith('O')
							? RotateCw
							: nav.next.code === 'U'
								? Undo2
								: nav.next.code.endsWith('L')
									? CornerUpLeft
									: CornerUpRight}
						<p
							class="flex items-center gap-2 font-display text-[24px] leading-snug"
							data-testid="nav-next"
						>
							<Icon size={28} aria-hidden="true" />{turnText(nav.next.code)}
						</p>
						<p class="type-h3">{m.nav_in()} {dist(nav.next.in)}</p>
					{:else}
						<p class="type-h2">{m.nav_head_to({ place: leg.to.name })}</p>
					{/if}
					<p class="mt-1 type-small" data-testid="nav-left">
						{#if nav}{nav.etaMin != null
								? `${m.nav_left({ d: dist(nav.left) })} · ${m.nav_eta({ n: nav.etaMin })}`
								: m.nav_left({ d: dist(nav.left) })}
						{:else if straightKm != null}{m.nav_straight({
								d: dist(straightKm * 1000)
							})}{:else}{m.emergency_locating()}{/if}
					</p>
				</div>
			{/if}
			<div class="flex flex-wrap items-center gap-2">
				<button
					type="button"
					class="flex min-h-11 items-center gap-2 border border-text bg-bg px-3 type-small"
					aria-pressed={voice}
					onclick={() => (voice = !voice)}
				>
					{#if voice}<Volume2 size={18} aria-hidden="true" />{:else}<VolumeX
							size={18}
							aria-hidden="true"
						/>{/if}{m.nav_voice()}
				</button>
				<span
					class="flex min-h-11 items-center gap-2 border border-text bg-bg px-3 type-small"
					data-testid="wake-lock"
				>
					<Sun size={18} aria-hidden="true" />{awake ? m.nav_awake_on() : m.nav_awake_off()}
				</span>
			</div>
		</div>

		<div
			class="absolute inset-x-3 bottom-[calc(80px+env(safe-area-inset-bottom))] z-10 mx-auto flex max-w-[560px] flex-col gap-2 lg:bottom-6"
		>
			{#if leg}
				<div class="flex flex-wrap gap-2">
					<Button variant={longDrive ? 'primary' : 'secondary'} href={gmaps}
						>{m.map_open_gmaps()}</Button
					>
					{#if arrived && idx < legs.length - 1}
						<Button onclick={() => ((idx += 1), (spoken = new Set()))}
							>{m.nav_next_stop({ place: legs[idx + 1]!.to.name })}</Button
						>
					{/if}
				</div>
				{#if olaLine && !leg.shape}
					<!-- BACKEND §6.1: Ola results are attributed wherever they show. -->
					<p class="border border-border bg-bg px-3 py-2 type-small" data-testid="ola-attribution">
						{m.nav_route_by()}
						<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener"
							>Ola Maps</a
						>
					</p>
				{/if}
				{#if longDrive}<p class="border border-border bg-bg px-3 py-2 type-small">
						{m.nav_long_drive()}
					</p>{/if}
				{#if turns.length}
					<details class="border border-border bg-bg px-3 py-2" data-testid="nav-steps">
						<summary class="min-h-11 cursor-pointer content-center type-small"
							>{m.nav_steps({ n: turns.length })}</summary
						>
						<ol class="flex flex-col gap-1 pb-2 type-small">
							{#each turns as t, i (i)}
								<li>{turnText(t.code)} · {dist(cum[t.at] ?? 0)}</li>
							{/each}
						</ol>
					</details>
				{/if}
			{/if}
			{#if suggestDark}
				<form
					method="POST"
					action="/prefs"
					class="flex flex-wrap items-center gap-2 bg-fuji px-3 py-2"
					data-testid="dark-suggest"
				>
					<input type="hidden" name="theme" value="dark" />
					<input type="hidden" name="return" value={page.url.pathname + page.url.search} />
					<p class="flex-1 type-small">{m.nav_dark_hint()}</p>
					<Button type="submit" variant="secondary">{m.nav_dark_on()}</Button>
					<Button type="button" variant="ghost" onclick={() => (darkDismissed = true)}
						>{m.nav_dark_no()}</Button
					>
				</form>
			{/if}
			<p class="border border-border bg-bg px-3 py-2 type-small text-text-2">
				{m.nav_limits()}
			</p>
		</div>
	{/if}
</main>
