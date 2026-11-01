<script lang="ts">
	import { submitting } from '#lib/forms.ts';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import { pushStatus, enablePush } from '#lib/push.ts';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Clock from '@lucide/svelte/icons/clock';
	import Car from '@lucide/svelte/icons/car';
	import Navigation from '@lucide/svelte/icons/navigation';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Bell from '@lucide/svelte/icons/bell';
	import type { PageProps } from './$types';

	// FRONTEND §7.11. Nudges are decided by rules on our plan times + matrix (no LLM); "Why?" asks Crabby.
	// GPS is used only on this device while the page is open; dwell visits are sent only with consent.
	let { data }: PageProps = $props();
	let now = $state(Date.now());
	let me = $state<[number, number] | null>(null);
	let push = $state<'on' | 'off' | 'unsupported' | 'denied'>('unsupported');
	const day = $derived(data.days[data.day - 1]);
	const raw = $derived(data.raw);
	const ms = (iso: string | null) => (iso ? Date.parse(iso) : null);
	const km = (a: [number, number], b: [number, number]) =>
		Math.hypot((b[0] - a[0]) * 106, (b[1] - a[1]) * 110.6);

	// Stop coordinates come from the cached routes payload (also used by navigation).
	let pts = $state<Record<string, [number, number]>>({});
	let legDur = $state<(number | null)[]>([]);
	// Where we are: at a stop (≤ 200 m), else the first stop not yet departed.
	const atIdx = $derived(
		me
			? (day?.stops.findIndex((s) => pts[s.entity_id] && km(me!, pts[s.entity_id]!) <= 0.2) ?? -1)
			: -1
	);
	const nextIdx = $derived(
		atIdx >= 0 ? atIdx + 1 : raw.findIndex((s) => (ms(s.depart_at) ?? 0) > now)
	);
	const next = $derived(nextIdx >= 0 ? day?.stops[nextIdx] : undefined);
	const lateMin = $derived(
		next && atIdx !== nextIdx
			? Math.round((now - (ms(raw[nextIdx]?.arrive_at ?? null) ?? now)) / 60000)
			: 0
	);
	const leaveNow = $derived(
		atIdx >= 0 && (ms(raw[atIdx]?.depart_at ?? null) ?? Infinity) <= now && !!next
	);

	// Opt-in dwell (DECISIONS: DPDPA consent, anonymous): arrival ≤ 150 m, leaving > 300 m after ≥ 5 min.
	let visit: { slug: string; at: string; since: number } | null = null;
	const anonId = () => {
		const key = `cw_dwell_${new Date().toISOString().slice(0, 10)}`;
		try {
			return (
				localStorage.getItem(key) ??
				(localStorage.setItem(key, crypto.randomUUID()), localStorage.getItem(key)!)
			);
		} catch {
			return crypto.randomUUID();
		}
	};
	function trackDwell(p: [number, number]) {
		if (!data.dwellConsent) return;
		const near = day?.stops.find(
			(s) => s.kind === 'place' && pts[s.entity_id] && km(p, pts[s.entity_id]!) <= 0.15
		);
		const slug = near?.href?.split('/').at(-1);
		if (!visit && slug) visit = { slug, at: new Date().toISOString(), since: Date.now() };
		if (visit && !near) {
			const left = visit;
			const far = day?.stops.every((s) => !pts[s.entity_id] || km(p, pts[s.entity_id]!) > 0.3);
			if (far) {
				visit = null;
				if (Date.now() - left.since >= 5 * 60000)
					fetch('/api/dwell', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							place: left.slug,
							anon_id: anonId(),
							arrived_at: left.at,
							left_at: new Date().toISOString()
						})
					}).catch(() => {});
			}
		}
	}

	onMount(() => {
		fetch(`/api/trips/${data.trip.id}/routes`)
			.then((r) =>
				r.ok
					? (r.json() as Promise<{
							days: {
								day: number;
								legs: { to: { at: [number, number] }; duration_s: number | null }[];
							}[];
						}>)
					: null
			)
			.then((r) => {
				const legs = r?.days.find((d) => d.day === data.day)?.legs ?? [];
				const map: Record<string, [number, number]> = {};
				day?.stops.forEach((s, i) => legs[i] && (map[s.entity_id] = legs[i].to.at));
				pts = map;
				legDur = legs.map((l) => l.duration_s);
			})
			.catch(() => {});
		const tick = setInterval(() => (now = Date.now()), 30000);
		const watch = navigator.geolocation?.watchPosition(
			(p) => {
				me = [p.coords.longitude, p.coords.latitude];
				trackDwell(me);
			},
			() => {},
			{ enableHighAccuracy: true, maximumAge: 15000 }
		);
		pushStatus().then((s) => (push = s));
		return () => {
			clearInterval(tick);
			if (watch != null) navigator.geolocation.clearWatch(watch);
		};
	});
	// Stop dots in the map pin colours (T-26), as on the plan timeline.
	const dot = (k: string) =>
		k === 'meal' ? 'bg-alphonso' : k === 'stay' ? 'bg-lagoon' : 'bg-kokum';
	const clock = (iso: string | null) =>
		iso
			? new Intl.DateTimeFormat(`${getLocale()}-IN`, {
					hour: 'numeric',
					minute: '2-digit',
					timeZone: 'Asia/Kolkata'
				}).format(new Date(iso))
			: '';
</script>

<Page title={data.trip.title} back>
	<!-- Tideline (Report 2 §9.9, T-34), in the locked order: current-stop hero → next stop + ETA → nudge → Navigate. -->
	<div class="mx-auto flex max-w-170 flex-col gap-4" data-testid="live-trip">
		<form
			method="POST"
			action={data.live ? '?/stop' : '?/start'}
			use:submitting
			class={[
				'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-4 py-3',
				data.live ? 'bg-ok-50' : 'bg-surface-2'
			]}
		>
			{#if data.live}<span class="size-2.5 shrink-0 rounded-full bg-ok" aria-hidden="true"
				></span>{/if}
			<p class={['min-w-0 flex-1 type-small', data.live ? 'text-text' : 'text-text-2']}>
				{data.live ? m.live_on() : m.live_off()}
			</p>
			<Button type="submit" variant="outline">{data.live ? m.live_stop() : m.live_start()}</Button>
		</form>

		{#if atIdx >= 0 && day?.stops[atIdx]}
			{@const here = day.stops[atIdx]}
			<section
				class="flex flex-col gap-2 rounded-xl bg-lagoon-50 p-5 lg:p-8"
				data-testid="current-stop"
			>
				<p class="flex items-center gap-2 type-label text-lagoon-ink">
					<MapPin size={18} class="text-lagoon" aria-hidden="true" />{m.live_here()}
				</p>
				<h2 class="type-display break-words text-text" data-clip-check>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href built from a known route + slug -->
					{#if here.href}<a href={here.href} class="text-text no-underline hover:underline"
							>{here.name}</a
						>{:else}{here.name}{/if}
				</h2>
				{#if here.depart}<p class="type-body text-text tabular-nums">
						{m.live_until({ t: here.depart })}
					</p>{/if}
			</section>
		{/if}

		{#if next}
			<section
				class="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-e1 lg:p-5"
				data-testid="next-stop"
			>
				<p class="flex items-center gap-2 type-label text-text-2">
					<span class={['size-2.5 rounded-full', dot(next.kind)]} aria-hidden="true"
					></span>{m.live_next()}
				</p>
				<h2 class="type-h2 break-words">{next.name}</h2>
				<p
					class="flex flex-wrap items-center gap-x-4 gap-y-1 type-body text-text-2 tabular-nums"
					data-testid="next-eta"
				>
					<span class="flex items-center gap-1.5"
						><Clock size={18} aria-hidden="true" />{m.live_planned({
							t: clock(raw[nextIdx]?.arrive_at ?? null)
						})}</span
					>
					{#if legDur[nextIdx]}<span class="flex items-center gap-1.5"
							><Car size={18} aria-hidden="true" />{m.live_drive({
								n: Math.round(legDur[nextIdx]! / 60)
							})}</span
						>{/if}
				</p>
			</section>

			{#if lateMin >= 20 && next.kind === 'place'}
				<div
					class="flex flex-col gap-3 rounded-lg bg-caution-50 p-4"
					role="status"
					data-testid="nudge-late"
				>
					<p class="flex gap-2.5 type-body text-text">
						<TriangleAlert size={20} class="mt-0.5 shrink-0" aria-hidden="true" />
						{m.nudge_late({ n: lateMin, place: next.name ?? '' })}
					</p>
					<div class="flex flex-wrap gap-2">
						<form method="POST" action="?/skip" use:submitting>
							<input type="hidden" name="day" value={data.day} />
							<input type="hidden" name="entity_id" value={next.entity_id} />
							<Button type="submit" variant="outline">{m.nudge_skip()}</Button>
						</form>
						<Button
							variant="outline"
							href={`${resolve('/crabby')}?ask=${encodeURIComponent(m.nudge_why_q({ place: next.name ?? '' }))}`}
							>{m.nudge_why()}</Button
						>
					</div>
				</div>
			{:else if leaveNow}
				<p
					class="flex gap-2.5 rounded-lg bg-caution-50 p-4 type-body text-text"
					role="status"
					data-testid="nudge-leave"
				>
					<Clock size={20} class="mt-0.5 shrink-0" aria-hidden="true" />
					{m.nudge_leave({ place: next.name ?? '' })}
				</p>
			{/if}

			<div class="[&>*]:min-h-14 [&>*]:w-full">
				<Button
					href={`${resolve('/navigate')}?trip=${data.trip.id}&day=${data.day}&leg=${nextIdx}`}
				>
					{#snippet icon()}<Navigation size={22} aria-hidden="true" />{/snippet}
					{m.live_navigate()}
				</Button>
			</div>
		{:else}
			<p
				class="flex items-center gap-2.5 rounded-lg bg-surface p-4 type-body text-text shadow-e1"
				data-testid="live-done"
			>
				<CircleCheck size={20} class="shrink-0 text-ok" aria-hidden="true" />{m.live_done()}
			</p>
		{/if}

		{#if push === 'off'}
			<div class="flex flex-col items-start gap-2 rounded-lg bg-surface-2 p-4">
				<Button
					variant="outline"
					onclick={async () => (push = (await enablePush()) ? 'on' : 'off')}
				>
					{#snippet icon()}<Bell size={20} aria-hidden="true" />{/snippet}
					{m.push_enable()}
				</Button>
				<p class="type-small text-text-2">{m.push_iphone()}</p>
			</div>
		{/if}
	</div>
</Page>
