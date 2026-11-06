<script lang="ts">
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import LocateFixed from '@lucide/svelte/icons/locate-fixed';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import { untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import { formatINR } from '#lib/format.ts';
	import Button from '../Button.svelte';
	import Chip from '../Chip.svelte';
	import Segmented from '../Segmented.svelte';

	// Trip setup inside the plan workspace: every planner question (FRONTEND §7.8 order: days → start → group →
	// budget → interests → pace → Standout) on one screen, prefilled from this trip (or the profile quiz on a new
	// trip). Generate fills this trip's itinerary (POST /api/trips/{id}/generate); again = replace it, after a confirm.
	type Start = { label: string; type: string; lon: number; lat: number };
	export type SetupValues = {
		days: number;
		start_date: string | null;
		start: { label: string; lon: number; lat: number } | null;
		group_type: 'family' | 'couple' | 'solo' | 'friends' | null;
		people: number | null;
		budget: number | null;
		interests: string[];
		pace: 'relaxed' | 'balanced' | 'packed' | null;
		standout: boolean;
		diet: 'veg' | 'non_veg' | 'jain' | null;
	};
	let {
		tripId,
		starts,
		tomorrow,
		values,
		hasStops,
		ondone
	}: {
		tripId: string;
		starts: Start[];
		tomorrow: string;
		values: SetupValues;
		hasStops: boolean;
		ondone: () => void | Promise<void>;
	} = $props();

	const CATS = [
		'beach',
		'fort',
		'temple',
		'waterfall',
		'viewpoint',
		'backwater',
		'cave',
		'museum',
		'village',
		'market',
		'orchard'
	] as const;
	// A snapshot of the trip's inputs; the workspace remounts this section per trip.
	const v = untrack(() => values);
	const firstDay = untrack(() => tomorrow);
	// A start point that isn't a station or bus stand was the traveller's own location.
	const ownStart = untrack(() => !!v.start && !starts.some((s) => s.label === v.start!.label));
	let days = $state(v.days);
	let startDate = $state(v.start_date && v.start_date >= firstDay ? v.start_date : firstDay);
	let startQuery = $state(ownStart ? '' : (v.start?.label ?? ''));
	let gps = $state<{ lon: number; lat: number } | null>(
		ownStart && v.start ? { lon: v.start.lon, lat: v.start.lat } : null
	);
	let group = $state<'family' | 'couple' | 'solo' | 'friends'>(v.group_type ?? 'family');
	let people = $state(v.people ?? 2);
	let budget = $state(v.budget ?? 15000);
	let noBudget = $state(v.start != null && v.budget == null);
	let interests = $state<string[]>([...v.interests]);
	let pace = $state<'relaxed' | 'balanced' | 'packed'>(v.pace ?? 'balanced');
	let standout = $state(v.standout);
	let diet = $state<'' | 'veg' | 'non_veg' | 'jain'>(v.diet ?? '');
	let status = $state<'idle' | 'busy' | 'error' | 'gps'>('idle');

	let gpsLabel = $state(ownStart && v.start ? v.start.label : '');
	const start = $derived(
		gps
			? { label: gpsLabel || m.plan_my_location(), ...gps }
			: starts.find((s) => s.label === startQuery.trim())
	);

	function useGps() {
		navigator.geolocation?.getCurrentPosition(
			(p) => {
				gps = { lon: p.coords.longitude, lat: p.coords.latitude };
				gpsLabel = '';
				startQuery = '';
			},
			() => (status = 'gps'),
			{ enableHighAccuracy: false, timeout: 15000, maximumAge: 0 }
		);
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!start) return;
		if (hasStops && !confirm(m.plan_regenerate_confirm())) return;
		status = 'busy';
		const res = await fetch(`/api/trips/${tripId}/generate`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				days,
				start_date: startDate,
				start: { label: start.label, lon: start.lon, lat: start.lat },
				group_type: group,
				people,
				budget: noBudget ? null : budget,
				interests,
				pace,
				standout,
				diet: diet || null
			})
		}).catch(() => null);
		if (!res?.ok) {
			status = 'error';
			return;
		}
		status = 'idle';
		await ondone();
	}

	const round =
		'flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text transition-colors duration-200 hover:bg-surface-3 disabled:text-muted disabled:hover:bg-surface-2';
	const q = 'flex flex-col gap-2';
	const qTitle = 'type-body-strong';
</script>

<form onsubmit={submit} class="flex flex-col gap-6" data-testid="trip-setup">
	<p class="type-small text-text-2">{m.plan_setup_hint()}</p>

	<div class="grid gap-6 md:grid-cols-2">
		<div class={q}>
			<span class={qTitle} id="setup-days">{m.plan_days()}</span>
			<div class="flex items-center gap-3" role="group" aria-labelledby="setup-days">
				<button
					type="button"
					class={round}
					aria-label={m.plan_fewer_days()}
					disabled={days <= 1}
					onclick={() => days--}><Minus size={22} aria-hidden="true" /></button
				>
				<span class="min-w-24 text-center type-h2" aria-live="polite" data-testid="days"
					>{m.plan_n_days({ n: days })}</span
				>
				<button
					type="button"
					class={round}
					aria-label={m.plan_more_days()}
					disabled={days >= 7}
					onclick={() => days++}><Plus size={22} aria-hidden="true" /></button
				>
			</div>
			<label class="flex flex-col gap-1.5 type-small text-text-2">
				{m.plan_start_date()}
				<input
					type="date"
					bind:value={startDate}
					min={tomorrow}
					required
					class="field h-12 px-4 type-body text-text"
				/>
			</label>
		</div>

		<div class={q}>
			<label class="flex flex-col gap-1.5">
				<span class={qTitle}>{m.plan_start()}</span>
				<span class="type-small text-text-2">{m.plan_start_hint()}</span>
				<input
					list="setup-starts"
					bind:value={startQuery}
					oninput={() => (gps = null)}
					autocomplete="off"
					class="field h-12 px-4 type-body text-text"
				/>
			</label>
			<datalist id="setup-starts">
				{#each starts as s (s.label)}<option value={s.label}>{msg(`util_${s.type}`)}</option>{/each}
			</datalist>
			<div class="flex flex-wrap items-center gap-3">
				<Button type="button" variant="secondary" onclick={useGps}>
					{#snippet icon()}<LocateFixed size={20} aria-hidden="true" />{/snippet}
					{m.plan_use_location()}
				</Button>
				{#if gps}<span class="type-body-strong text-ok" role="status">{start?.label} ✓</span>{/if}
				{#if status === 'gps'}<span class="type-small" role="alert">{m.qr_gps_off()}</span>{/if}
			</div>
		</div>

		<div class={q}>
			<span class={qTitle}>{m.plan_group()}</span>
			<Segmented
				label={m.plan_group()}
				bind:value={group}
				options={(['family', 'couple', 'friends', 'solo'] as const).map((g) => ({
					value: g,
					label: msg(`group_${g}`)
				}))}
			/>
			<div class="flex items-center justify-between gap-4">
				<span class="type-body" id="setup-people">{m.plan_people()}</span>
				<div class="flex items-center gap-3" role="group" aria-labelledby="setup-people">
					<button
						type="button"
						class={round}
						aria-label={`${m.plan_people()} −`}
						disabled={people <= 1}
						onclick={() => people--}><Minus size={22} aria-hidden="true" /></button
					>
					<span class="min-w-8 text-center type-h3 tabular-nums" aria-live="polite">{people}</span>
					<button
						type="button"
						class={round}
						aria-label={`${m.plan_people()} +`}
						disabled={people >= 50}
						onclick={() => people++}><Plus size={22} aria-hidden="true" /></button
					>
				</div>
			</div>
		</div>

		<div class={q}>
			<span class={qTitle}>{m.plan_budget()}</span>
			<p class="type-h3 tabular-nums" aria-live="polite">
				{noBudget ? m.plan_no_budget() : formatINR(budget)}
			</p>
			<input
				type="range"
				min="2000"
				max="100000"
				step="500"
				bind:value={budget}
				disabled={noBudget}
				aria-label={m.plan_budget()}
				class="h-11 w-full accent-(--kokum)"
			/>
			<label class="flex min-h-11 items-center gap-3 type-body">
				<input type="checkbox" bind:checked={noBudget} class="size-5 accent-(--kokum)" />
				{m.plan_no_budget()}
			</label>
		</div>

		<div class={[q, 'md:col-span-2']}>
			<span class={qTitle}>{m.plan_interests()}</span>
			<p class="type-small text-text-2">{m.plan_interests_hint()}</p>
			<div class="flex flex-wrap gap-2">
				{#each CATS as c (c)}
					<Chip
						selected={interests.includes(c)}
						onchange={(on) =>
							(interests = on ? [...interests, c] : interests.filter((x) => x !== c))}
						>{msg(`cat_${c}`)}</Chip
					>
				{/each}
			</div>
			<span class="type-body">{m.plan_diet()}</span>
			<Segmented
				label={m.plan_diet()}
				bind:value={diet}
				options={[
					{ value: '', label: m.filter_any() },
					{ value: 'veg', label: m.diet_veg() },
					{ value: 'non_veg', label: m.diet_nonveg() },
					{ value: 'jain', label: m.diet_jain() }
				]}
			/>
		</div>

		<div class={q}>
			<span class={qTitle}>{m.plan_pace()}</span>
			<Segmented
				label={m.plan_pace()}
				bind:value={pace}
				options={(['relaxed', 'balanced', 'packed'] as const).map((p) => ({
					value: p,
					label: msg(`pace_${p}`)
				}))}
			/>
		</div>

		<label class="flex min-h-16 items-center gap-4 self-end rounded-lg bg-surface-2 p-4 type-body">
			<Sparkles size={24} aria-hidden="true" class="shrink-0 text-alphonso-ink" />
			<span class="flex-1">{m.plan_standout_hint()}</span>
			<input
				type="checkbox"
				role="switch"
				bind:checked={standout}
				class="relative h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-border-strong transition-colors duration-200 before:absolute before:top-1 before:left-1 before:size-5 before:rounded-full before:bg-surface before:shadow-e1 before:transition-transform before:duration-200 checked:bg-kokum checked:before:translate-x-5 motion-reduce:before:transition-none"
			/>
		</label>
	</div>

	<div class="flex flex-col gap-2">
		{#if !start}<p class="type-small text-text-2">{m.plan_pick_start()}</p>{/if}
		{#if status === 'error'}<p class="type-body" role="alert">{m.send_failed()}</p>{/if}
		<div class="[&>*]:w-full sm:[&>*]:w-auto">
			<Button type="submit" loading={status === 'busy'} disabled={!start}
				>{hasStops ? m.plan_regenerate() : m.plan_generate()}</Button
			>
		</div>
	</div>
</form>
