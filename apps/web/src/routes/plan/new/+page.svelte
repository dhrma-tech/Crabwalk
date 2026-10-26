<script lang="ts">
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import LocateFixed from '@lucide/svelte/icons/locate-fixed';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import { formatINR } from '#lib/format.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import Chip from '#lib/components/Chip.svelte';
	import Segmented from '#lib/components/Segmented.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import type { PageProps } from './$types';
	import { page } from '$app/state';
	import { loginHref } from '#lib/login.ts';

	// FRONTEND §7.8 (LOCKED order): days → start → group → budget → interests → pace → Standout → Generate.
	// Tideline (Report 2 §9.7, T-31): one question per step with a progress bar, big targets, Back / Next in a
	// bar above the phone nav (the thumb zone), and a full-width kokum "Generate" on the last step.
	let { data }: PageProps = $props();
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
	const STEPS = 7;

	let step = $state(0);
	let days = $state(2);
	let startDate = $state('');
	let startQuery = $state('');
	let gps = $state<{ lon: number; lat: number } | null>(null);
	let group = $state<'family' | 'couple' | 'solo' | 'friends'>('family');
	let people = $state(2);
	let budget = $state(15000);
	let noBudget = $state(false);
	let interests = $state<string[]>([]);
	let pace = $state<'relaxed' | 'balanced' | 'packed'>('balanced');
	let standout = $state(false);
	let diet = $state<'' | 'veg' | 'non_veg' | 'jain'>('');
	let status = $state<'idle' | 'busy' | 'error' | 'gps'>('idle');
	let heading: HTMLElement | undefined = $state();
	$effect(() => {
		if (!startDate) startDate = data.tomorrow;
	});

	const start = $derived(
		gps
			? { label: m.plan_my_location(), ...gps }
			: data.starts.find((s) => s.label === startQuery.trim())
	);
	// Step 2 needs a start point before moving on; every other step has a valid default.
	const blocked = $derived(step === 1 && !start);

	function useGps() {
		navigator.geolocation?.getCurrentPosition(
			(p) => {
				gps = { lon: p.coords.longitude, lat: p.coords.latitude };
				startQuery = '';
			},
			() => (status = 'gps'),
			{ enableHighAccuracy: false, timeout: 15000, maximumAge: 0 }
		);
	}

	async function go(to: number) {
		step = to;
		// Move focus to the new question so screen readers and keyboards follow the step.
		await tick();
		heading?.focus();
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		// Enter on an earlier step moves on; only the last step generates.
		if (step < STEPS - 1) return void (!blocked && go(step + 1));
		if (!start) return void go(1);
		status = 'busy';
		const res = await fetch('/api/trips/plan', {
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
		const { id } = (await res.json()) as { id: string };
		await goto(resolve('/plan/[id]', { id }));
	}

	const questions = [
		m.plan_days,
		m.plan_start,
		m.plan_group,
		m.plan_budget,
		m.plan_interests,
		m.plan_pace,
		m.plan_standout
	];
	const round =
		'flex size-14 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text transition-colors duration-200 hover:bg-surface-3 disabled:text-muted disabled:hover:bg-surface-2';
</script>

<Page title={m.nav_plan()}>
	{#if !data.signedIn}
		<EmptyState title={m.plan_title()} body={m.plan_signin()}>
			{#snippet action()}<Button href={loginHref(page.url)}>{m.sign_in()}</Button>{/snippet}
		</EmptyState>
	{:else}
		<form
			onsubmit={submit}
			class="mx-auto flex min-h-[calc(100dvh-var(--bar-h)-var(--nav-h)-3rem)] max-w-170 flex-col gap-6 lg:min-h-0"
			data-testid="planner"
		>
			<div class="flex flex-col gap-2">
				<p class="type-label text-text-2">
					{m.plan_title()} · {m.plan_step({ n: step + 1, total: STEPS })}
				</p>
				<div
					class="h-1.5 overflow-hidden rounded-full bg-surface-2"
					role="progressbar"
					aria-label={m.plan_title()}
					aria-valuemin={1}
					aria-valuemax={STEPS}
					aria-valuenow={step + 1}
				>
					<div
						class="h-full rounded-full bg-kokum transition-[width] duration-300 ease-brand"
						style:width={`${((step + 1) / STEPS) * 100}%`}
					></div>
				</div>
			</div>

			<h2 bind:this={heading} tabindex="-1" class="type-display outline-none">
				{questions[step]!()}
			</h2>

			<div class="flex flex-1 flex-col gap-5" data-clip-check>
				{#if step === 0}
					<div class="flex items-center gap-4">
						<button
							type="button"
							class={round}
							aria-label={m.plan_fewer_days()}
							disabled={days <= 1}
							onclick={() => days--}><Minus size={24} aria-hidden="true" /></button
						>
						<span class="min-w-28 text-center type-h1" aria-live="polite" data-testid="days"
							>{m.plan_n_days({ n: days })}</span
						>
						<button
							type="button"
							class={round}
							aria-label={m.plan_more_days()}
							disabled={days >= 7}
							onclick={() => days++}><Plus size={24} aria-hidden="true" /></button
						>
					</div>
					<label class="flex max-w-80 flex-col gap-1.5 type-small text-text-2">
						{m.plan_start_date()}
						<input
							type="date"
							bind:value={startDate}
							min={data.tomorrow}
							required
							class="field h-13 px-4 type-body text-text"
						/>
					</label>
				{:else if step === 1}
					<label class="flex flex-col gap-1.5 type-small text-text-2">
						{m.plan_start_hint()}
						<input
							list="starts"
							bind:value={startQuery}
							oninput={() => (gps = null)}
							autocomplete="off"
							class="field h-13 px-4 type-body text-text"
						/>
					</label>
					<datalist id="starts">
						{#each data.starts as s (s.label)}<option value={s.label}
								>{msg(`util_${s.type}`)}</option
							>{/each}
					</datalist>
					<div class="flex flex-wrap items-center gap-3">
						<Button type="button" variant="secondary" onclick={useGps}>
							{#snippet icon()}<LocateFixed size={20} aria-hidden="true" />{/snippet}
							{m.plan_use_location()}
						</Button>
						{#if gps}<span class="type-body-strong text-ok" role="status"
								>{m.plan_my_location()} ✓</span
							>{/if}
						{#if status === 'gps'}<span class="type-small" role="alert">{m.qr_gps_off()}</span>{/if}
					</div>
				{:else if step === 2}
					<Segmented
						label={m.plan_group()}
						bind:value={group}
						options={(['family', 'couple', 'friends', 'solo'] as const).map((g) => ({
							value: g,
							label: msg(`group_${g}`)
						}))}
					/>
					<div class="flex items-center justify-between gap-4">
						<span class="type-body-strong" id="people-label">{m.plan_people()}</span>
						<div class="flex items-center gap-3" role="group" aria-labelledby="people-label">
							<button
								type="button"
								class={round}
								aria-label={`${m.plan_people()} −`}
								disabled={people <= 1}
								onclick={() => people--}><Minus size={24} aria-hidden="true" /></button
							>
							<span class="min-w-10 text-center type-h2 tabular-nums" aria-live="polite"
								>{people}</span
							>
							<button
								type="button"
								class={round}
								aria-label={`${m.plan_people()} +`}
								disabled={people >= 50}
								onclick={() => people++}><Plus size={24} aria-hidden="true" /></button
							>
						</div>
					</div>
				{:else if step === 3}
					<p class="type-h1 tabular-nums" aria-live="polite">
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
				{:else if step === 4}
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
					<div class="flex flex-col gap-2">
						<span class="type-body-strong">{m.plan_diet()}</span>
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
				{:else if step === 5}
					<Segmented
						label={m.plan_pace()}
						bind:value={pace}
						options={(['relaxed', 'balanced', 'packed'] as const).map((p) => ({
							value: p,
							label: msg(`pace_${p}`)
						}))}
					/>
				{:else}
					<label
						class="flex min-h-16 items-center gap-4 rounded-lg bg-surface p-4 type-body shadow-e1"
					>
						<Sparkles size={24} aria-hidden="true" class="shrink-0 text-alphonso-ink" />
						<span class="flex-1">{m.plan_standout_hint()}</span>
						<!-- A real switch: --border-strong track off (≥ 3:1 on the card), kokum on. -->
						<input
							type="checkbox"
							role="switch"
							bind:checked={standout}
							class="relative h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-border-strong transition-colors duration-200 before:absolute before:top-1 before:left-1 before:size-5 before:rounded-full before:bg-surface before:shadow-e1 before:transition-transform before:duration-200 checked:bg-kokum checked:before:translate-x-5 motion-reduce:before:transition-none"
						/>
					</label>
					{#if status === 'error'}<p class="type-body" role="alert">{m.send_failed()}</p>{/if}
				{/if}
			</div>

			<!-- Thumb zone: pinned above the phone nav. -->
			<div
				class="sticky bottom-(--nav-h) -mx-5 flex flex-col gap-2 bg-bg px-5 py-3 lg:static lg:mx-0 lg:px-0"
			>
				{#if blocked}<p class="type-small text-text-2">{m.plan_pick_start()}</p>{/if}
				{#if step < STEPS - 1}
					<div class="flex gap-3">
						{#if step > 0}<Button type="button" variant="secondary" onclick={() => go(step - 1)}
								>{m.back()}</Button
							>{/if}
						<div class="flex-1 [&>*]:w-full">
							<Button type="submit" disabled={blocked}>{m.plan_next()}</Button>
						</div>
					</div>
				{:else}
					<div class="flex gap-3">
						<Button type="button" variant="secondary" onclick={() => go(step - 1)}
							>{m.back()}</Button
						>
						<div class="flex-1 [&>*]:w-full">
							<Button type="submit" loading={status === 'busy'} disabled={!start}
								>{m.plan_generate()}</Button
							>
						</div>
					</div>
				{/if}
			</div>
		</form>
	{/if}
</Page>
