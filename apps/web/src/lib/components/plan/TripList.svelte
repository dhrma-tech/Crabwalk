<script lang="ts" module>
	import type { PlanStop } from './PlanDays.svelte';

	export type ListItem = {
		id: string;
		kind: 'place' | 'note' | 'check';
		entity_type: 'place' | 'stay' | 'eatery' | null;
		entity_id: string | null;
		body: string | null;
		done: boolean;
		name: string | null;
		href: string | null;
		pt: { lon: number; lat: number } | null;
	};
	export type TripListData = { id: string | null; title: string; items: ListItem[] };
	export type Recommended = {
		slug: string;
		name: string;
		category: string | null;
		isGem: boolean;
		pt: { lon: number; lat: number } | null;
	};
	/** A list place shaped like a day stop, so it can be dragged into a day's timeline. */
	export const asStop = (i: ListItem): PlanStop & { listItem: true } => ({
		id: i.id,
		kind: i.entity_type === 'eatery' ? 'meal' : i.entity_type === 'stay' ? 'stay' : 'place',
		entity_type: i.entity_type!,
		entity_id: i.entity_id!,
		name: i.name,
		href: i.href,
		arrive: null,
		depart: null,
		travelMin: null,
		reason: null,
		pt: i.pt,
		listItem: true
	});
</script>

<script lang="ts">
	import { dndzone } from 'svelte-dnd-action';
	import X from '@lucide/svelte/icons/x';
	import Plus from '@lucide/svelte/icons/plus';
	import MapIcon from '@lucide/svelte/icons/map';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { m } from '#lib/paraglide/messages.js';
	import type { WorkspaceOp } from '#lib/server/planner/workspace.ts';
	import ScrollProgress from '../ScrollProgress.svelte';

	// One trip list (P11 §3): places (numbered like their map pins, dragged or "Move to day…" into the
	// itinerary), notes and checklist items, an add-a-place search over our published listings, and a
	// Recommended row. `list.id` null = the default list, created by its first item.
	let {
		list,
		days,
		recommended,
		editable = true,
		active = null,
		onop,
		onmap,
		onpick
	}: {
		list: TripListData;
		days: number;
		recommended: Recommended[];
		editable?: boolean;
		active?: string | null;
		onop: (o: WorkspaceOp) => void;
		/** Show this list's places on the map. */
		onmap: () => void;
		onpick: (item: ListItem) => void;
	} = $props();

	// Places as a drag zone shared with the day timelines (drops into a list stay off).
	let work = $derived(list.items.filter((i) => i.kind === 'place').map(asStop));
	const texts = $derived(list.items.filter((i) => i.kind !== 'place'));
	const byId = $derived(new Map(list.items.map((i) => [i.id, i])));
	const base = $derived({ list_id: list.id, list_title: list.title });

	let q = $state('');
	let hits = $state<{ kind: 'place' | 'stay' | 'eatery'; slug: string; name: string }[]>([]);
	let timer: ReturnType<typeof setTimeout>;
	function search() {
		clearTimeout(timer);
		if (q.trim().length < 2) return void (hits = []);
		timer = setTimeout(async () => {
			const r = await fetch(`/api/map/search?q=${encodeURIComponent(q.trim())}`).catch(() => null);
			const all: { kind: string; slug: string; name: string }[] = r?.ok ? await r.json() : [];
			hits = all.filter((h) => h.kind !== 'dish') as typeof hits;
		}, 300);
	}
	function addPlace(type: 'place' | 'stay' | 'eatery', slug: string) {
		onop({ op: 'item.add', ...base, item: { kind: 'place', type, slug } });
		q = '';
		hits = [];
	}
	let text = $state('');
	function addText(kind: 'note' | 'check') {
		const body = text.trim();
		if (!body) return;
		onop({ op: 'item.add', ...base, item: { kind, body } });
		text = '';
	}
	const iconBtn =
		'flex size-11 shrink-0 items-center justify-center rounded-full text-text-2 hover:bg-surface-2 hover:text-text print:hidden';
	const pin = (k: PlanStop['kind']) =>
		k === 'meal'
			? 'bg-alphonso text-on-alphonso'
			: k === 'stay'
				? 'bg-lagoon text-on-lagoon'
				: 'bg-kokum text-on-kokum';
</script>

<div
	id={list.id ? `list-${list.id}` : 'list-default'}
	class="flex scroll-mt-4 scroll-scope flex-col gap-3 rounded-md border border-border p-3"
	data-testid="trip-list"
>
	<div class="flex items-center gap-1">
		{#if editable && list.id}
			<label class="sr-only" for="title-{list.id}">{m.plan_list_name()}</label>
			<input
				id="title-{list.id}"
				value={list.title}
				maxlength="80"
				class="field h-11 min-w-0 flex-1 bg-transparent px-2 type-h3 text-text"
				onchange={(e) => {
					const title = e.currentTarget.value.trim();
					if (title && title !== list.title) onop({ op: 'list.rename', id: list.id!, title });
				}}
			/>
		{:else}
			<h3 class="min-w-0 flex-1 px-2 type-h3">{list.title}</h3>
		{/if}
		{#if work.length}
			<button type="button" class={iconBtn} aria-label={m.plan_list_on_map()} onclick={onmap}
				><MapIcon size={20} aria-hidden="true" /></button
			>
		{/if}
		{#if editable && list.id}
			<button
				type="button"
				class={iconBtn}
				aria-label={m.plan_list_delete()}
				onclick={() => {
					if (confirm(m.plan_list_delete_confirm())) onop({ op: 'list.delete', id: list.id! });
				}}><Trash2 size={20} aria-hidden="true" /></button
			>
		{/if}
	</div>

	{#if !list.items.length}
		<p class="px-2 type-small text-text-2">{m.plan_list_empty()}</p>
	{/if}

	<ol
		class="flex min-h-2 flex-col gap-2"
		use:dndzone={{
			items: work,
			flipDurationMs: 150,
			type: 'stop',
			dragDisabled: !editable,
			dropFromOthersDisabled: true,
			dropTargetStyle: {}
		}}
		onconsider={(e) => (work = e.detail.items)}
		onfinalize={(e) => {
			const before = list.items.filter((i) => i.kind === 'place').map((i) => i.id);
			work = e.detail.items;
			const now = work.map((s) => s.id);
			// Dragged into a day: the day saves the stop, the list lets the item go.
			for (const id of before.filter((id) => !now.includes(id))) onop({ op: 'item.delete', id });
			if (list.id && now.length === before.length && now.some((id, k) => id !== before[k]))
				onop({ op: 'item.order', list_id: list.id, ids: now });
		}}
	>
		{#each work as s, k (s.id)}
			<li
				id="item-{s.id}"
				class={[
					'flex scroll-my-24 flex-wrap items-center gap-2 rounded-md bg-surface p-2 shadow-e1',
					active === s.id && 'ring-2 ring-kokum'
				]}
				data-testid="list-place"
				data-active={active === s.id || undefined}
			>
				<button
					type="button"
					class={[
						'relative flex size-6 shrink-0 items-center justify-center rounded-full type-label after:absolute after:-inset-2.5',
						pin(s.kind)
					]}
					aria-label={m.plan_item_on_map({ n: k + 1 })}
					onclick={() => {
						const it = byId.get(s.id);
						if (it) onpick(it);
					}}>{k + 1}</button
				>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href built from a known route + slug -->
				{#if s.href}<a
						href={s.href}
						draggable="false"
						class="min-w-0 flex-1 truncate type-body text-text">{s.name}</a
					>{:else}<span class="min-w-0 flex-1 truncate type-body">{s.name}</span>{/if}
				{#if editable}
					<label class="sr-only" for="move-{s.id}">{m.plan_list_move()}</label>
					<select
						id="move-{s.id}"
						class="field h-11 max-w-32 px-2 type-small text-text max-sm:order-last max-sm:max-w-none max-sm:basis-full print:hidden"
						onchange={(e) => {
							const day = Number(e.currentTarget.value);
							if (day) onop({ op: 'item.toDay', id: s.id, day });
						}}
					>
						<option value="">{m.plan_list_move()}</option>
						{#each Array.from({ length: days }, (_, d) => d + 1) as d (d)}
							<option value={d}>{m.plan_day_n({ n: d })}</option>
						{/each}
					</select>
					<button
						type="button"
						class={iconBtn}
						aria-label={m.plan_remove()}
						onclick={() => onop({ op: 'item.delete', id: s.id })}
						><X size={20} aria-hidden="true" /></button
					>
				{/if}
			</li>
		{/each}
	</ol>

	{#if texts.length}
		<ul class="flex flex-col gap-1">
			{#each texts as t (t.id)}
				<li class="flex items-start gap-2 px-2" data-testid="list-text" data-kind={t.kind}>
					{#if t.kind === 'check'}
						<input
							type="checkbox"
							class="mt-3 size-5 shrink-0 accent-kokum"
							checked={t.done}
							disabled={!editable}
							aria-label={m.plan_item_done({ text: t.body ?? '' })}
							onchange={(e) => onop({ op: 'item.done', id: t.id, done: e.currentTarget.checked })}
						/>
					{/if}
					<p
						class={[
							'min-w-0 flex-1 py-2.5 type-body whitespace-pre-line',
							t.kind === 'check' && t.done && 'text-text-2 line-through'
						]}
					>
						{t.body}
					</p>
					{#if editable}
						<button
							type="button"
							class={iconBtn}
							aria-label={m.plan_remove()}
							onclick={() => onop({ op: 'item.delete', id: t.id })}
							><X size={20} aria-hidden="true" /></button
						>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	{#if editable}
		<div class="relative flex flex-col gap-2 print:hidden">
			<label class="sr-only" for="add-{list.id ?? 'default'}">{m.plan_list_add_place()}</label>
			<input
				id="add-{list.id ?? 'default'}"
				type="search"
				bind:value={q}
				oninput={search}
				placeholder={m.plan_list_add_place()}
				autocomplete="off"
				class="field h-11 px-3 type-body text-text"
			/>
			{#if hits.length}
				<ul class="flex flex-col rounded-md bg-surface shadow-e2" data-testid="list-hits">
					{#each hits.slice(0, 8) as h (h.kind + h.slug)}
						<li>
							<button
								type="button"
								class="row-link flex min-h-11 w-full items-center gap-2 px-3 text-left type-body text-text"
								onclick={() => addPlace(h.kind, h.slug)}
								><Plus size={18} aria-hidden="true" class="text-text-2" />{h.name}</button
							>
						</li>
					{/each}
				</ul>
			{/if}
			<div class="flex flex-wrap items-center gap-2">
				<label class="sr-only" for="text-{list.id ?? 'default'}">{m.plan_list_add_text()}</label>
				<input
					id="text-{list.id ?? 'default'}"
					bind:value={text}
					maxlength="2000"
					placeholder={m.plan_list_add_text()}
					class="field h-11 min-w-0 flex-1 basis-48 px-3 type-body text-text"
					onkeydown={(e) => {
						if (e.key === 'Enter') addText('note');
					}}
				/>
				<button
					type="button"
					class="inline-flex min-h-11 items-center rounded-full px-3 type-label text-kokum-ink hover:bg-surface"
					onclick={() => addText('note')}>{m.plan_list_add_note()}</button
				>
				<button
					type="button"
					class="inline-flex min-h-11 items-center rounded-full px-3 type-label text-kokum-ink hover:bg-surface"
					onclick={() => addText('check')}>{m.plan_list_add_check()}</button
				>
			</div>
		</div>
	{/if}

	{#if editable && recommended.length}
		<div class="flex flex-col gap-1 print:hidden" data-testid="recommended">
			<h4 class="px-2 type-label text-text-2">{m.plan_recommended()}</h4>
			<ul class="scroll-row -mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
				{#each recommended as r (r.slug)}
					<li
						class="flex w-44 shrink-0 items-center gap-1 rounded-md bg-surface py-1 pr-1 pl-3 shadow-e1"
					>
						<span class="flex min-w-0 flex-1 flex-col">
							<span class="truncate type-small text-text">{r.name}</span>
							{#if r.isGem}<span class="type-label text-lagoon-ink">{m.hidden_gem()}</span>{/if}
						</span>
						<button
							type="button"
							class={iconBtn}
							aria-label={m.plan_recommended_add({ name: r.name })}
							onclick={() => addPlace('place', r.slug)}
							><Plus size={20} aria-hidden="true" /></button
						>
					</li>
				{/each}
			</ul>
			<ScrollProgress />
		</div>
	{/if}
</div>
