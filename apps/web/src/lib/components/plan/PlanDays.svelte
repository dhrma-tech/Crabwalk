<script lang="ts" module>
	export type PlanStop = {
		id: string;
		kind: 'place' | 'meal' | 'stay';
		entity_type: string;
		entity_id: string;
		name: string | null;
		href: string | null;
		arrive: string | null;
		depart: string | null;
		travelMin: number | null;
		reason: string | null;
	};
	export type PlanDay = { date: string | null; stops: PlanStop[]; links: string[] };
	export type AddOption = { kind: 'meal' | 'stay'; entity_id: string; name: string };
</script>

<script lang="ts">
	import { dndzone } from 'svelte-dnd-action';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import X from '@lucide/svelte/icons/x';
	import Car from '@lucide/svelte/icons/car';
	import ThumbsUp from '@lucide/svelte/icons/thumbs-up';
	import ThumbsDown from '@lucide/svelte/icons/thumbs-down';
	import { m } from '#lib/paraglide/messages.js';
	import { formatDate } from '#lib/format.ts';
	import RouteStrip from './RouteStrip.svelte';
	import type { StripLeg } from '#lib/nav/strip.ts';

	// FRONTEND §7.9: day tabs → timeline (time, travel time, reason chip) → drag to reorder → add stay/meal.
	// Tideline (Report 2 §9.8, T-32): segmented day tabs, the day's route strip, a lagoon timeline with the time on
	// the left and stop cards on the right, dotted car connectors between stops. `links=false`: the plan view moves
	// the Google Maps links into its overflow sheet.
	let {
		days,
		editable = false,
		add = [],
		votes = {},
		routes = [],
		links = true,
		onchange
	}: {
		days: PlanDay[];
		editable?: boolean;
		add?: AddOption[][];
		votes?: Record<string, { up: number; down: number }>;
		routes?: { day: number; legs: (StripLeg & { to: { name: string } })[] }[];
		links?: boolean;
		onchange?: (days: { kind: PlanStop['kind']; entity_id: string }[][]) => void;
	} = $props();

	let tab = $state(0);
	// Local copy for drag preview (writable derived): reset whenever the server sends a new plan.
	let work = $derived(days.map((d) => d.stops.map((s) => ({ ...s }))));

	const emit = () =>
		onchange?.(work.map((d) => d.map((s) => ({ kind: s.kind, entity_id: s.entity_id }))));
	function move(d: number, i: number, by: number) {
		const list = [...work[d]!];
		const [x] = list.splice(i, 1);
		list.splice(i + by, 0, x!);
		work[d] = list;
		emit();
	}
	function remove(d: number, i: number) {
		work[d] = work[d]!.filter((_, k) => k !== i);
		emit();
	}
	function addStop(d: number, value: string) {
		const o = add[d]?.find((x) => `${x.kind}:${x.entity_id}` === value);
		if (!o) return;
		const list = [...work[d]!];
		// Meals go before the night's stay; a stay goes last.
		const stayAt = list.findIndex((s) => s.kind === 'stay');
		const stop = {
			id: crypto.randomUUID(),
			kind: o.kind,
			entity_type: o.kind === 'meal' ? 'eatery' : 'stay',
			entity_id: o.entity_id,
			name: o.name,
			href: null,
			arrive: null,
			depart: null,
			travelMin: null,
			reason: null
		};
		if (o.kind === 'stay') work[d] = [...list.filter((s) => s.kind !== 'stay'), stop];
		else
			work[d] =
				stayAt < 0 ? [...list, stop] : [...list.slice(0, stayAt), stop, ...list.slice(stayAt)];
		emit();
	}
	const kindLabel = (k: PlanStop['kind']) =>
		k === 'meal' ? m.plan_kind_meal() : k === 'stay' ? m.plan_kind_stay() : null;
	// Stop dots in the map pin colours (T-26): places kokum, meals alphonso, stays lagoon.
	const dot = (k: PlanStop['kind']) =>
		k === 'meal' ? 'bg-alphonso' : k === 'stay' ? 'bg-lagoon' : 'bg-kokum';
	const iconBtn =
		'flex size-11 items-center justify-center rounded-full text-text-2 transition-colors duration-200 hover:bg-surface-2 hover:text-text disabled:text-muted disabled:hover:bg-transparent';
</script>

<div class="flex flex-col gap-5">
	<div class="-mx-5 overflow-x-auto px-5 print:hidden lg:mx-0 lg:px-0">
		<div
			class="inline-flex rounded-full bg-surface-2 p-0.5"
			role="tablist"
			aria-label={m.plan_days()}
		>
			{#each days as d, i (i)}
				<button
					type="button"
					role="tab"
					id="day-tab-{i}"
					aria-selected={tab === i}
					aria-controls="day-{i}"
					class={[
						'min-h-11 shrink-0 rounded-full px-4 type-label whitespace-nowrap transition-[background-color,box-shadow,color] duration-200',
						tab === i ? 'bg-surface text-text shadow-e1' : 'text-text-2 hover:text-text'
					]}
					onclick={() => (tab = i)}
					>{m.plan_day_n({ n: i + 1 })}{d.date ? ` · ${formatDate(d.date)}` : ''}</button
				>
			{/each}
		</div>
	</div>

	{#each days as d, i (i)}
		<div
			id="day-{i}"
			role="tabpanel"
			aria-labelledby="day-tab-{i}"
			class={['flex flex-col gap-4', tab !== i && 'hidden print:flex']}
			data-testid="plan-day"
		>
			<h2 class="hidden type-h2 print:block">
				{m.plan_day_n({ n: i + 1 })}{d.date ? ` · ${formatDate(d.date)}` : ''}
			</h2>
			{#if routes[i]?.legs.length}
				<RouteStrip legs={routes[i]!.legs} label={m.plan_day_n({ n: i + 1 })} />
			{/if}
			{#if !work[i]?.length}
				<p class="type-body text-text-2">{m.plan_day_empty()}</p>
			{:else}
				<ol
					class="flex flex-col"
					use:dndzone={{
						items: work[i]!,
						flipDurationMs: 150,
						dragDisabled: !editable,
						dropTargetStyle: {}
					}}
					onconsider={(e) => (work[i] = e.detail.items)}
					onfinalize={(e) => {
						work[i] = e.detail.items;
						emit();
					}}
				>
					{#each work[i]! as s, k (s.id)}
						<li
							class="grid grid-cols-[4rem_1rem_1fr] gap-x-3"
							data-testid="plan-stop"
							data-kind={s.kind}
						>
							{#if s.travelMin}
								<!-- Drive from the previous stop: a dotted connector with a car. -->
								<span></span>
								<span class="flex justify-center" aria-hidden="true"
									><span class="w-0 border-l-2 border-dotted border-lagoon"></span></span
								>
								<p class="flex items-center gap-1.5 py-2 type-small text-text-2">
									<Car size={16} aria-hidden="true" />{m.plan_travel({ n: s.travelMin })}
								</p>
							{/if}
							<span
								class="pt-3 text-right type-small text-text-2 tabular-nums"
								data-testid="stop-time"
								>{s.arrive ?? '—'}{#if s.depart && s.kind !== 'stay'}–<br />{s.depart}{/if}</span
							>
							<span class="flex flex-col items-center" aria-hidden="true">
								<span class={['mt-4 size-3 shrink-0 rounded-full ring-2 ring-bg', dot(s.kind)]}
								></span>
								<span class="w-0.5 flex-1 bg-lagoon"></span>
							</span>
							<div class="pb-3">
								<div
									class="flex flex-col gap-1 rounded-md bg-surface p-3 shadow-e1 sm:flex-row sm:items-start sm:justify-between sm:gap-2"
								>
									<div class="flex min-w-0 flex-col gap-1">
										{#if kindLabel(s.kind)}<span class="type-label text-text-2"
												>{kindLabel(s.kind)}</span
											>{/if}
										<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href built from a known route + slug -->
										{#if s.href}<a href={s.href} class="type-h3 text-text">{s.name}</a>{:else}<span
												class="type-h3">{s.name ?? '—'}</span
											>{/if}
										{#if s.reason}<span class="flex flex-wrap gap-1" data-testid="stop-reason"
												>{#each s.reason.split(' · ') as r, n (n)}<span
														class="rounded-full bg-surface-2 px-2.5 py-0.5 type-label text-text-2"
														>{r}</span
													>{/each}</span
											>{/if}
										{#if votes[s.entity_id]}<span
												class="flex items-center gap-1.5 type-small text-text-2"
												data-testid="stop-votes"
												><ThumbsUp size={16} aria-label={m.gvote_up()} />{votes[s.entity_id]!
													.up}<ThumbsDown size={16} aria-label={m.gvote_down()} />{votes[
													s.entity_id
												]!.down}</span
											>{/if}
									</div>
									{#if editable}
										<div
											class="-mr-1.5 -mb-1.5 flex shrink-0 self-end print:hidden sm:-my-1.5 sm:self-start"
										>
											<button
												type="button"
												class={iconBtn}
												aria-label={m.plan_move_up()}
												disabled={k === 0}
												onclick={() => move(i, k, -1)}
												><ArrowUp size={20} aria-hidden="true" /></button
											>
											<button
												type="button"
												class={iconBtn}
												aria-label={m.plan_move_down()}
												disabled={k === work[i]!.length - 1}
												onclick={() => move(i, k, 1)}
												><ArrowDown size={20} aria-hidden="true" /></button
											>
											<button
												type="button"
												class={iconBtn}
												aria-label={m.plan_remove()}
												onclick={() => remove(i, k)}><X size={20} aria-hidden="true" /></button
											>
										</div>
									{/if}
								</div>
							</div>
						</li>
					{/each}
				</ol>
			{/if}

			{#if editable && add[i]?.length}
				<label class="flex flex-col gap-1.5 type-small text-text-2 print:hidden">
					{m.plan_add()}
					<select
						class="field h-12 px-3 type-body text-text"
						onchange={(e) => {
							addStop(i, e.currentTarget.value);
							e.currentTarget.value = '';
						}}
					>
						<option value="">{m.plan_add_pick()}</option>
						{#each add[i]! as o (o.kind + o.entity_id)}
							<option value="{o.kind}:{o.entity_id}"
								>{o.kind === 'meal' ? m.plan_kind_meal() : m.plan_kind_stay()} · {o.name}</option
							>
						{/each}
					</select>
				</label>
			{/if}

			{#if links && d.links.length}
				<div class="flex flex-wrap gap-2 print:hidden" data-testid="gmaps">
					{#each d.links as l, j (l)}
						<!-- eslint-disable svelte/no-navigation-without-resolve -- external Google Maps link -->
						<a
							href={l}
							target="_blank"
							rel="noopener"
							class="group inline-flex min-h-11 items-center no-underline"
							><span
								class="inline-flex min-h-9 items-center rounded-full border-[1.5px] border-border-strong px-4 type-label text-text group-hover:bg-surface-2"
								>{m.plan_gmaps()}{d.links.length > 1 ? ` ${j + 1}/${d.links.length}` : ''}</span
							></a
						>
					{/each}
				</div>
			{/if}
		</div>
	{/each}
</div>
