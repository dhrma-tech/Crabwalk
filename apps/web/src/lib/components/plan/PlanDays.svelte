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

	// FRONTEND §7.9: day tabs → timeline (time, travel time, reason chip) → drag to reorder → add stay/meal.
	let {
		days,
		editable = false,
		add = [],
		votes = {},
		onchange
	}: {
		days: PlanDay[];
		editable?: boolean;
		add?: AddOption[][];
		votes?: Record<string, { up: number; down: number }>;
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
	// Suna timeline (2a): a dot per stop on a hairline; tint by kind.
	const tint = (k: PlanStop['kind']) => (k === 'meal' ? 'sakura' : k === 'stay' ? 'asagi' : 'yama');
</script>

<div class="flex flex-col gap-4">
	<div
		class="flex gap-5 overflow-x-auto border-b border-border print:hidden"
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
					'-mb-px min-h-11 shrink-0 border-b-2 type-body',
					tab === i ? 'border-text font-medium text-text' : 'border-transparent text-text-2'
				]}
				onclick={() => (tab = i)}
				>{m.plan_day_n({ n: i + 1 })}{d.date ? ` · ${formatDate(d.date)}` : ''}</button
			>
		{/each}
	</div>

	{#each days as d, i (i)}
		<div
			id="day-{i}"
			role="tabpanel"
			aria-labelledby="day-tab-{i}"
			class={['flex flex-col gap-3', tab !== i && 'hidden print:flex']}
			data-testid="plan-day"
		>
			<h2 class="hidden type-h2 print:block">
				{m.plan_day_n({ n: i + 1 })}{d.date ? ` · ${formatDate(d.date)}` : ''}
			</h2>
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
							class="grid grid-cols-[3.5rem_9px_1fr] gap-x-3.5 bg-bg"
							data-testid="plan-stop"
							data-kind={s.kind}
						>
							<span class="pt-0.5 text-[13px] leading-snug text-text-2" data-testid="stop-time"
								>{s.arrive ?? '—'}{s.depart && s.kind !== 'stay' ? `–${s.depart}` : ''}</span
							>
							<span class="flex flex-col items-center" aria-hidden="true">
								<span
									class="mt-2 size-[9px] rounded-full"
									style:background="var(--{tint(s.kind)}-s)"
								></span>
								<span class="w-px flex-1 bg-border"></span>
							</span>
							<div class="flex items-start justify-between gap-3 pb-4">
								<div class="flex min-w-0 flex-col">
									{#if s.travelMin}
										<p class="flex items-center gap-1.5 text-[12px] text-text-2">
											<Car size={14} aria-hidden="true" />{m.plan_travel({ n: s.travelMin })}
										</p>
									{/if}
									{#if kindLabel(s.kind)}<span class="text-[12px] text-text-2"
											>{kindLabel(s.kind)}</span
										>{/if}
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href built from a known route + slug -->
									{#if s.href}<a href={s.href} class="type-h3">{s.name}</a>{:else}<span
											class="type-h3">{s.name ?? '—'}</span
										>{/if}
									{#if s.reason}<span
											class="mt-1 self-start px-2 text-[12px]"
											style:background="var(--{tint(s.kind)})"
											data-testid="stop-reason">{s.reason}</span
										>{/if}
									{#if votes[s.entity_id]}<span
											class="mt-1 flex items-center gap-1.5 type-small text-text-2"
											data-testid="stop-votes"
											><ThumbsUp size={16} aria-label={m.gvote_up()} />{votes[s.entity_id]!
												.up}<ThumbsDown size={16} aria-label={m.gvote_down()} />{votes[s.entity_id]!
												.down}</span
										>{/if}
								</div>
								{#if editable}
									<div class="flex shrink-0 gap-1 print:hidden">
										<button
											type="button"
											class="flex size-11 items-center justify-center text-link disabled:opacity-40"
											aria-label={m.plan_move_up()}
											disabled={k === 0}
											onclick={() => move(i, k, -1)}
											><ArrowUp size={20} aria-hidden="true" /></button
										>
										<button
											type="button"
											class="flex size-11 items-center justify-center text-link disabled:opacity-40"
											aria-label={m.plan_move_down()}
											disabled={k === work[i]!.length - 1}
											onclick={() => move(i, k, 1)}
											><ArrowDown size={20} aria-hidden="true" /></button
										>
										<button
											type="button"
											class="flex size-11 items-center justify-center text-text-2"
											aria-label={m.plan_remove()}
											onclick={() => remove(i, k)}><X size={20} aria-hidden="true" /></button
										>
									</div>
								{/if}
							</div>
						</li>
					{/each}
				</ol>
			{/if}

			{#if editable && add[i]?.length}
				<label class="flex flex-col gap-1.5 type-small text-text-2 print:hidden">
					{m.plan_add()}
					<select
						class="h-11 border-b border-text bg-bg type-body text-text"
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

			{#if d.links.length}
				<div class="flex flex-wrap gap-2 print:hidden" data-testid="gmaps">
					{#each d.links as l, j (l)}
						<!-- eslint-disable svelte/no-navigation-without-resolve -- external Google Maps link -->
						<a
							href={l}
							target="_blank"
							rel="noopener"
							class="flex min-h-11 items-center border border-text px-4 type-small text-text no-underline"
							>{m.plan_gmaps()}{d.links.length > 1 ? ` ${j + 1}/${d.links.length}` : ''}</a
						>
					{/each}
				</div>
			{/if}
		</div>
	{/each}
</div>
