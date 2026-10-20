<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import { formatINR } from '#lib/format.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import Chip from '#lib/components/Chip.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import type { PageProps } from './$types';
	import { page } from '$app/state';
	import { loginHref } from '#lib/login.ts';

	// FRONTEND §7.8 (LOCKED order): days → start → group → budget → interests → pace → Standout → Generate.
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
	$effect(() => {
		if (!startDate) startDate = data.tomorrow;
	});

	const start = $derived(
		gps
			? { label: m.plan_my_location(), ...gps }
			: data.starts.find((s) => s.label === startQuery.trim())
	);

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

	async function generate(e: SubmitEvent) {
		e.preventDefault();
		if (!start) return;
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

	const seg = (on: boolean) => [
		'min-h-11 flex-1 px-3 type-small',
		on ? 'bg-text text-bg' : 'text-text-2'
	];
</script>

<Page title={m.nav_plan()}>
	{#if !data.signedIn}
		<EmptyState title={m.plan_title()} body={m.plan_signin()}>
			{#snippet action()}<Button href={loginHref(page.url)}>{m.sign_in()}</Button>{/snippet}
		</EmptyState>
	{:else}
		<form
			onsubmit={generate}
			class="mx-auto flex max-w-[680px] flex-col gap-6"
			data-testid="planner"
		>
			<h2 class="type-h1">{m.plan_title()}</h2>

			<section class="flex flex-col gap-2">
				<h2 class="type-h3">1 · {m.plan_days()}</h2>
				<div class="flex items-center gap-3">
					<Button
						type="button"
						variant="secondary"
						aria-label={m.plan_fewer_days()}
						disabled={days <= 1}
						onclick={() => days--}>−</Button
					>
					<span class="min-w-16 text-center type-h2" aria-live="polite" data-testid="days"
						>{m.plan_n_days({ n: days })}</span
					>
					<Button
						type="button"
						variant="secondary"
						aria-label={m.plan_more_days()}
						disabled={days >= 7}
						onclick={() => days++}>+</Button
					>
				</div>
				<label class="flex flex-col gap-1.5 type-small text-text-2">
					{m.plan_start_date()}
					<input
						type="date"
						bind:value={startDate}
						min={data.tomorrow}
						required
						class="h-11 border-b border-text bg-bg type-body text-text"
					/>
				</label>
			</section>

			<section class="flex flex-col gap-2">
				<h2 class="type-h3">2 · {m.plan_start()}</h2>
				<label class="flex flex-col gap-1.5 type-small text-text-2">
					{m.plan_start_hint()}
					<input
						list="starts"
						bind:value={startQuery}
						oninput={() => (gps = null)}
						autocomplete="off"
						class="h-11 border-b border-text bg-bg type-body text-text"
					/>
				</label>
				<datalist id="starts">
					{#each data.starts as s (s.label)}<option value={s.label}>{msg(`util_${s.type}`)}</option
						>{/each}
				</datalist>
				<div class="flex flex-wrap items-center gap-3">
					<Button type="button" variant="ghost" onclick={useGps}>{m.plan_use_location()}</Button>
					{#if gps}<span class="type-small" role="status">{m.plan_my_location()} ✓</span>{/if}
					{#if status === 'gps'}<span class="type-small" role="alert">{m.qr_gps_off()}</span>{/if}
				</div>
			</section>

			<section class="flex flex-col gap-2">
				<h2 class="type-h3">3 · {m.plan_group()}</h2>
				<div class="flex border border-border p-0.5" role="group" aria-label={m.plan_group()}>
					{#each ['family', 'couple', 'friends', 'solo'] as const as g (g)}
						<button
							type="button"
							aria-pressed={group === g}
							class={seg(group === g)}
							onclick={() => (group = g)}>{msg(`group_${g}`)}</button
						>
					{/each}
				</div>
				<label class="flex items-center justify-between gap-3 type-body">
					{m.plan_people()}
					<input
						type="number"
						min="1"
						max="50"
						bind:value={people}
						class="h-11 w-24 border-b border-text bg-bg type-body text-text"
					/>
				</label>
			</section>

			<section class="flex flex-col gap-2">
				<h2 class="type-h3">4 · {m.plan_budget()}</h2>
				<input
					type="range"
					min="2000"
					max="100000"
					step="500"
					bind:value={budget}
					disabled={noBudget}
					aria-label={m.plan_budget()}
					class="h-11 w-full accent-[var(--cta)]"
				/>
				<p class="type-body" aria-live="polite">
					{noBudget ? m.plan_no_budget() : formatINR(budget)}
				</p>
				<label class="flex items-center gap-2 type-small"
					><input type="checkbox" bind:checked={noBudget} />{m.plan_no_budget()}</label
				>
			</section>

			<section class="flex flex-col gap-2">
				<h2 class="type-h3">5 · {m.plan_interests()}</h2>
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
				<label class="flex flex-col gap-1.5 type-small text-text-2">
					{m.plan_diet()}
					<select bind:value={diet} class="h-11 border-b border-text bg-bg type-body text-text">
						<option value="">{m.filter_any()}</option>
						<option value="veg">{m.diet_veg()}</option>
						<option value="non_veg">{m.diet_nonveg()}</option>
						<option value="jain">{m.diet_jain()}</option>
					</select>
				</label>
			</section>

			<section class="flex flex-col gap-2">
				<h2 class="type-h3">6 · {m.plan_pace()}</h2>
				<div class="flex border border-border p-0.5" role="group" aria-label={m.plan_pace()}>
					{#each ['relaxed', 'balanced', 'packed'] as const as p (p)}
						<button
							type="button"
							aria-pressed={pace === p}
							class={seg(pace === p)}
							onclick={() => (pace = p)}>{msg(`pace_${p}`)}</button
						>
					{/each}
				</div>
			</section>

			<section class="flex flex-col gap-2">
				<h2 class="type-h3">7 · {m.plan_standout()}</h2>
				<label class="flex items-center gap-3 type-body">
					<input type="checkbox" role="switch" bind:checked={standout} class="size-6" />
					{m.plan_standout_hint()}
				</label>
			</section>

			{#if status === 'error'}<p class="type-body" role="alert">{m.send_failed()}</p>{/if}
			<div>
				<Button type="submit" loading={status === 'busy'} disabled={!start}
					>{m.plan_generate()}</Button
				>
				{#if !start}<p class="mt-2 type-small text-text-2">{m.plan_pick_start()}</p>{/if}
			</div>
		</form>
	{/if}
</Page>
