<script lang="ts">
	import Share2 from '@lucide/svelte/icons/share-2';
	import Link from '@lucide/svelte/icons/link';
	import Users from '@lucide/svelte/icons/users';
	import FileDown from '@lucide/svelte/icons/file-down';
	import X from '@lucide/svelte/icons/x';
	import { onMount, tick, untrack } from 'svelte';
	import { PMTILES_BASE_URL } from '$app/env/public';
	import { submitting } from '#lib/forms.ts';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import { toast } from '#lib/toast.svelte.ts';
	import { decide, type Action } from '#lib/crabby.svelte.ts';
	import Meta from '#lib/components/Meta.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import BottomSheet, { type Snap } from '#lib/components/BottomSheet.svelte';
	import MapView, { type StopPin } from '#lib/components/map/MapView.svelte';
	import Button from '#lib/components/Button.svelte';
	import IconButton from '#lib/components/IconButton.svelte';
	import PlanDays from '#lib/components/plan/PlanDays.svelte';
	import BudgetCard from '#lib/components/plan/BudgetCard.svelte';
	import WorkspaceSection from '#lib/components/plan/WorkspaceSection.svelte';
	import Outline, { type OutlineItem } from '#lib/components/plan/Outline.svelte';
	import TripList, { asStop, type ListItem } from '#lib/components/plan/TripList.svelte';
	import Expenses from '#lib/components/plan/Expenses.svelte';
	import type { PlanStop } from '#lib/components/plan/PlanDays.svelte';
	import { formatINR } from '#lib/format.ts';
	import { tripSync, type Req } from '#lib/tripSync.svelte.ts';
	import { browserClient } from '#lib/supabase.ts';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import Redo2 from '@lucide/svelte/icons/redo-2';
	import Check from '@lucide/svelte/icons/check';
	import CloudOff from '@lucide/svelte/icons/cloud-off';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Eye from '@lucide/svelte/icons/eye';
	import type { OpResult, WorkspaceOp } from '#lib/server/planner/workspace.ts';
	import type { StripLeg } from '#lib/nav/strip.ts';
	import type { PageProps } from './$types';

	// FRONTEND §7.9: day tabs → timeline → reorder → add stay/meal → budget → share / PDF / Google Maps.
	// P11 workspace (docs/P11 Plan workspace.md §2–§3): laptops = outline · sections column · map; phones = map
	// on top with the sections in a bottom sheet. Sections: overview, places to visit (lists), itinerary, expenses, notes. Sections fold; the outline unfolds and scrolls to one. Share,
	// vote link, PDF and each day's Google Maps links sit in a Share sheet.
	let { data, form }: PageProps = $props();
	let snap = $state<Snap>('half');
	let wide = $state(false);
	let innerHeight = $state(800);
	let tab = $state(0);
	let mapFailed = $state(!PMTILES_BASE_URL);
	onMount(() => {
		const mq = matchMedia('(min-width: 1024px)');
		const on = () => (wide = mq.matches);
		on();
		mq.addEventListener('change', on);
		return () => mq.removeEventListener('change', on);
	});
	// Phones: keep the map's focus above the sheet.
	const padBottom = $derived(
		wide ? 0 : snap === 'peek' ? 132 : snap === 'half' ? innerHeight * 0.5 : 0
	);
	const firstPt = $derived(data.days.flatMap((d) => d.stops).find((s) => s.pt)?.pt ?? null);
	// Map ↔ list sync (§2): the map shows the selected day; a stop's number pans to its pin, a pin picks its stop.
	let activeStop = $state<string | null>(null);
	const dayStops = $derived<StopPin[]>(
		(data.days[tab]?.stops ?? []).flatMap((s, k) =>
			s.pt ? [{ id: s.id, n: k + 1, kind: s.kind, lon: s.pt.lon, lat: s.pt.lat }] : []
		)
	);
	// Or a list's places (§2): set by the list's map button or a place's number, cleared by the day tabs.
	let focusList = $state<string | null>(null);
	const focused = $derived(data.lists.find((l) => l.id === focusList));
	const mapStops = $derived<StopPin[]>(
		focused
			? focused.items
					.filter((i) => i.kind === 'place')
					.flatMap((i, k) =>
						i.pt ? [{ id: i.id, n: k + 1, kind: asStop(i).kind, lon: i.pt.lon, lat: i.pt.lat }] : []
					)
			: dayStops
	);
	$effect(() => {
		void tab;
		untrack(() => (focusList = null));
	});
	function pickStop(id: string, list: string | null = null) {
		focusList = list;
		activeStop = id;
		if (!wide && snap === 'full') snap = 'half';
	}
	function showList(id: string | null) {
		focusList = id;
		activeStop = null;
		if (!wide && snap === 'full') snap = 'half';
	}
	async function showStop(id: string) {
		activeStop = id;
		open[focusList ? 'places' : 'itinerary'] = true;
		if (!wide && snap === 'peek') snap = 'half';
		await tick();
		document
			.getElementById(`${focusList ? 'item' : 'stop'}-${id}`)
			?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}
	const spent = $derived(data.spends.reduce((t, s) => t + s.amount, 0));
	const lists = $derived(
		data.lists.length ? data.lists : [{ id: null, title: m.plan_places(), items: [] as ListItem[] }]
	);

	const open = $state({
		overview: true,
		places: true,
		itinerary: true,
		expenses: true,
		notes: true,
		publish: true
	});
	const allOpen = $derived(Object.values(open).every(Boolean));
	function toggleAll() {
		const to = !allOpen;
		for (const k of Object.keys(open) as (keyof typeof open)[]) open[k] = to;
	}
	const outline = $derived<OutlineItem[]>([
		{ id: 'overview', label: m.plan_overview(), section: 'overview' },
		{ id: 'places', label: m.plan_places(), section: 'places' },
		...data.lists.map((l) => ({
			id: `list-${l.id}`,
			label: l.title,
			section: 'places',
			sub: true
		})),
		{ id: 'itinerary', label: m.plan_itinerary(), section: 'itinerary' },
		...data.days.map((_, i) => ({
			id: `day-${i}`, // PlanDays' panel id
			label: m.plan_day_n({ n: i + 1 }),
			section: 'itinerary',
			sub: true
		})),
		{ id: 'expenses', label: m.plan_expenses(), section: 'expenses' },
		{ id: 'notes', label: m.plan_notes(), section: 'notes' },
		{ id: 'publish', label: m.plan_publish_title(), section: 'publish' }
	]);
	async function pick(item: OutlineItem) {
		open[item.section as keyof typeof open] = true;
		if (item.sub && item.section === 'itinerary') tab = Number(item.id.slice(4));
		if (!wide && snap !== 'full') snap = 'full';
		await tick();
		document
			.getElementById(item.sub && item.section === 'places' ? item.id : item.section)
			?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
	const SLUG_PATTERN = '[a-z0-9-]{3,60}';
	let mergeState = $state<'applied' | 'discarded' | null>(null);
	// Saved trips' routes are cached automatically for offline navigation (FRONTEND §9); the same response draws
	// each day's route strip.
	type Routes = { days: { day: number; legs: (StripLeg & { to: { name: string } })[] }[] };
	let routes = $state<Routes | null>(null);
	let routesCached = $state(false);
	let routesLoading = $state(true);
	$effect(() => {
		void data.days;
		routesLoading = true;
		fetch(`/api/trips/${data.trip.id}/routes`)
			.then(async (r) => {
				routesCached = r.ok;
				routes = r.ok ? ((await r.json()) as Routes) : null;
			})
			.catch(() => (routesCached = false))
			.finally(() => (routesLoading = false));
	});
	async function applyMerge(a: Action, apply: boolean) {
		await decide(a, apply);
		mergeState = apply ? 'applied' : 'discarded';
		if (apply) await invalidateAll();
	}
	const origin = $derived(page.url.origin);

	// Edits (P11 §6): one ordered outbox (each PATCH carries the full latest order, so order matters), the
	// Saved / Saving… / Offline status, and undo/redo — each undoable edit is sent with its inverse.
	const sync = tripSync(
		untrack(() => data.trip.id),
		() => invalidateAll()
	);
	const editable = $derived(data.role !== 'viewer');
	const isOwner = $derived(data.role === 'owner');
	type Days = { kind: PlanStop['kind']; entity_id: string }[][];
	const wreq = (body: Record<string, unknown>, reload = true): Req => ({
		path: '/workspace',
		method: 'POST',
		body,
		reload
	});
	const daysReq = (days: Days): Req => ({ path: '', method: 'PATCH', body: { days } });
	const currentDays = (): Days =>
		data.days.map((d) => d.stops.map((s) => ({ kind: s.kind, entity_id: s.entity_id })));
	const patch = (body: Record<string, unknown>) => sync.send({ path: '', method: 'PATCH', body });
	const moveStops = (days: Days) => sync.send(daysReq(days), [daysReq(currentDays())]);
	const op = (o: WorkspaceOp) => {
		const r = wreq(o);
		sync.send(r, inverse(o, r));
	};
	/** The edit that undoes `o` (null = not undoable). New row ids come back in responses and are written into
	 * the paired request, so undo → redo → undo keeps pointing at the right row. */
	function inverse(o: WorkspaceOp, r: Req): Req[] | null {
		switch (o.op) {
			case 'item.add': {
				const u = wreq({ op: 'item.delete', id: '' });
				r.onres = (x) => {
					u.body.id = x.id;
					r.body.list_id = x.list_id;
				};
				return [u];
			}
			case 'item.delete':
			case 'item.toDay': {
				const l = data.lists.find((l) => l.items.some((i) => i.id === o.id));
				const it = l?.items.find((i) => i.id === o.id);
				if (!l || !it) return null;
				const add = wreq({
					op: 'item.add',
					list_id: l.id,
					list_title: l.title,
					item:
						it.kind === 'place'
							? { kind: 'place', type: it.entity_type, entity_id: it.entity_id }
							: { kind: it.kind, body: it.body, done: it.done }
				});
				add.onres = (x) => (r.body.id = x.id);
				return o.op === 'item.toDay' ? [daysReq(currentDays()), add] : [add];
			}
			case 'item.done':
				return [wreq({ ...o, done: !o.done })];
			case 'spend.add': {
				const u = wreq({ op: 'spend.delete', id: '' });
				r.onres = (x) => (u.body.id = x.id);
				return [u];
			}
			case 'spend.delete': {
				const s = data.spends.find((s) => s.id === o.id);
				if (!s) return null;
				const add = wreq({
					op: 'spend.add',
					amount: s.amount,
					category: s.category,
					label: s.label ?? '',
					paid_by: s.paid_by,
					spent_on: s.spent_on,
					split: { custom: true, shares: s.shares }
				});
				add.onres = (x) => (r.body.id = x.id);
				return [add];
			}
			default:
				return null;
		}
	}
	// Notes save as you type (not reloaded: the field keeps what is being typed); each save is one undo step.
	let notes = $derived(data.notes);
	let savedNotes = $derived(data.notes);
	let notesTimer: ReturnType<typeof setTimeout> | undefined;
	function flushNotes() {
		if (!notesTimer) return;
		clearTimeout(notesTimer);
		notesTimer = undefined;
		const before = savedNotes;
		const after = notes;
		if (before === after) return;
		savedNotes = after;
		const set = (v: string) => () => {
			notes = v;
			savedNotes = v;
		};
		sync.send({ ...wreq({ op: 'notes.save', body: after }, false), apply: set(after) }, [
			{ ...wreq({ op: 'notes.save', body: before }), apply: set(before) }
		]);
	}
	// Ctrl/⌘+Z undo, Ctrl/⌘+Shift+Z or Ctrl+Y redo — not while typing in a field (the field's own undo wins).
	function keys(e: KeyboardEvent) {
		if (!editable || !(e.ctrlKey || e.metaKey) || e.altKey) return;
		if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
		const k = e.key.toLowerCase();
		if (k === 'z' && !e.shiftKey) sync.undo();
		else if (k === 'y' || (k === 'z' && e.shiftKey)) sync.redo();
		else return;
		e.preventDefault();
	}

	// Live co-editing (§6): Realtime Postgres changes on this trip's rows (RLS applies per subscriber) reload the
	// page data, after our own queued edits land. Deletes can't be filtered by trip, so a delete counts when its
	// id is one we show. Spend shares change only with their spend, so trip_expenses covers them (Realtime also
	// refuses a filtered binding on the shares table).
	const LIVE = [
		'trip_stops',
		'trip_members',
		'trip_lists',
		'trip_list_items',
		'trip_notes',
		'trip_expenses'
	] as const;
	const shown = $derived(
		new Set([
			...data.lists.flatMap((l) => [l.id, ...l.items.map((i) => i.id)]),
			...data.spends.map((s) => s.id),
			...data.tripmates.map((t) => t.id)
		])
	);
	onMount(() => {
		sync.flush();
		const online = () => sync.flush();
		addEventListener('online', online);
		const id = data.trip.id;
		const db = browserClient();
		let t: ReturnType<typeof setTimeout> | undefined;
		const changed = () => {
			clearTimeout(t);
			t = setTimeout(() => {
				flushNotes();
				sync.refresh();
			}, 250);
		};
		// Filtered and unfiltered bindings go on separate channels: mixed on one, Realtime refuses the join.
		const ch = db.channel(`trip:${id}`);
		const del = db.channel(`trip:${id}:deletes`);
		for (const table of LIVE) {
			for (const event of ['INSERT', 'UPDATE'] as const)
				ch.on(
					'postgres_changes',
					{ event, schema: 'public', table, filter: `trip_id=eq.${id}` },
					changed
				);
			del.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, (p) => {
				const old = p.old as { id?: string };
				if (old.id && shown.has(old.id)) changed();
			});
		}
		// Join as the signed-in tripmate (the client hands its session to Realtime only after the first auth event).
		void db.auth.getSession().then(async ({ data: { session } }) => {
			await db.realtime.setAuth(session?.access_token ?? null);
			ch.subscribe();
			del.subscribe();
		});
		return () => {
			removeEventListener('online', online);
			clearTimeout(t);
			void db.removeChannel(ch);
			void db.removeChannel(del);
		};
	});

	// Invites (§6, owner): one live edit link and one view link, copied on demand; email adds an account straight
	// away or opens the owner's own mail app with the link (no mail service).
	async function call(o: WorkspaceOp) {
		const r = await fetch(`/api/trips/${data.trip.id}/workspace`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(o)
		}).catch(() => null);
		if (!r?.ok) {
			toast(m.send_failed());
			return null;
		}
		return (await r.json()) as OpResult;
	}
	async function inviteLink(role: 'editor' | 'viewer') {
		let token = data.invites.find((i) => i.role === role)?.token;
		if (!token) {
			token = (await call({ op: 'invite.link', role }))?.token;
			if (token) void invalidateAll();
		}
		return token ? `${origin}/plan/join/${token}` : null;
	}
	async function copyInvite(role: 'editor' | 'viewer') {
		const url = await inviteLink(role);
		if (url) await copy(url);
	}
	async function revokeInvites() {
		if (!(await call({ op: 'invite.revoke' }))) return;
		toast(m.plan_invite_revoked());
		await invalidateAll();
	}
	let inviteEmail = $state('');
	let inviteRole = $state<'editor' | 'viewer'>('editor');
	async function invite(e: SubmitEvent) {
		e.preventDefault();
		const email = inviteEmail.trim();
		const r = await call({ op: 'invite.email', email, role: inviteRole });
		if (!r) return;
		if (r.added) {
			toast(m.plan_invite_added({ email }));
			inviteEmail = '';
			await invalidateAll();
			return;
		}
		const url = await inviteLink(inviteRole);
		if (!url) return;
		const q = (s: string) => encodeURIComponent(s);
		location.href = `mailto:${q(email)}?subject=${q(m.plan_invite_mail_subject())}&body=${q(
			m.plan_invite_mail_body({ title: data.trip.title, link: url })
		)}`;
	}
	const accountMates = $derived(data.tripmates.filter((t) => t.account && t.role !== 'owner'));
	async function copy(text: string) {
		await navigator.clipboard?.writeText(text).catch(() => {});
		toast(m.plan_link_copied());
	}
	let sheet: HTMLDialogElement | undefined = $state();
	const block = 'flex flex-col gap-3 rounded-md bg-surface-2 p-4 print:hidden';
	const row =
		'row-link flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-left type-body text-text no-underline';
</script>

<svelte:window bind:innerHeight onkeydown={keys} />

<Meta title={data.trip.title} />
<TopBar title={data.trip.title} back />
<!-- Laptops: exactly the viewport under the top bar, so only the sections column scrolls. -->
<main
	id="main"
	class="relative min-h-0 flex-1 lg:flex lg:h-[calc(100dvh-var(--bar-h))] lg:flex-none print:block print:h-auto"
>
	<h1 class="sr-only">{data.trip.title}</h1>
	<aside
		class="hidden w-56 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border p-4 lg:flex print:hidden"
	>
		<Outline items={outline} label={m.plan_outline()} variant="rail" onpick={pick} />
		<button
			type="button"
			class="row-link inline-flex min-h-10 items-center rounded-md px-3 type-small text-text-2"
			onclick={toggleAll}>{allOpen ? m.plan_collapse_all() : m.plan_expand_all()}</button
		>
	</aside>

	<div
		class="absolute inset-0 lg:relative lg:inset-auto lg:order-last lg:flex-1 print:hidden"
		role="region"
		aria-label={m.plan_map()}
	>
		{#if mapFailed}
			<div class="size-full bg-surface-2"></div>
		{:else}
			<MapView
				tilesBase={PMTILES_BASE_URL!.replace(/\/$/, '')}
				showPins={false}
				initial={firstPt}
				{padBottom}
				stops={mapStops}
				stopLine={!focused}
				{activeStop}
				onstop={showStop}
				onselect={() => {}}
				onerror={() => (mapFailed = true)}
			/>
		{/if}
	</div>

	<BottomSheet bind:snap column>
		<div class="flex flex-col gap-5 lg:py-6">
			<header class="flex flex-col gap-3">
				<div class="flex items-start gap-2">
					{#if isOwner}
						<form
							method="POST"
							action="?/rename"
							use:submitting
							class="flex min-w-0 flex-1 gap-2 print:hidden"
						>
							<label class="sr-only" for="trip-title">{m.plan_rename()}</label>
							<input
								id="trip-title"
								name="title"
								value={data.trip.title}
								maxlength="120"
								class="field h-12 min-w-0 flex-1 px-3 type-h3 text-text"
							/>
							<Button type="submit" variant="secondary">{m.plan_save()}</Button>
						</form>
					{:else}
						<p class="min-w-0 flex-1 py-2.5 type-h3 print:hidden">{data.trip.title}</p>
					{/if}
					<div class="print:hidden">
						<IconButton
							label={m.plan_share_title()}
							aria-haspopup="dialog"
							onclick={() => sheet?.showModal()}><Share2 size={20} aria-hidden="true" /></IconButton
						>
					</div>
				</div>
				<h2 class="hidden type-h1 print:block">{data.trip.title}</h2>
				<p class="flex flex-wrap items-center gap-2">
					{#each [m.plan_n_days( { n: data.trip.days } ), data.trip.start, msg(`pace_${data.trip.pace}`)].filter(Boolean) as t (t)}
						<span
							class="inline-flex min-h-7 items-center rounded-full bg-surface-2 px-3 type-label text-text-2"
							>{t}</span
						>
					{/each}
					{#if !editable}<span
							class="inline-flex min-h-7 items-center rounded-full bg-surface-2 px-3 type-label text-text-2"
							>{m.plan_view_only()}</span
						>{/if}
				</p>
				{#if editable}
					<div class="flex items-center gap-1 print:hidden">
						<span
							class="inline-flex min-w-0 flex-1 items-center gap-1.5 type-small text-text-2"
							role="status"
							data-testid="save-status"
							data-status={sync.status}
						>
							{#if sync.status === 'offline'}<CloudOff
									size={16}
									aria-hidden="true"
								/>{m.plan_offline_sync()}
							{:else if sync.status === 'saving'}{m.plan_saving()}
							{:else}<Check size={16} aria-hidden="true" />{m.plan_saved()}{/if}
						</span>
						<IconButton label={m.plan_undo()} disabled={!sync.canUndo} onclick={() => sync.undo()}
							><Undo2 size={20} aria-hidden="true" /></IconButton
						>
						<IconButton label={m.plan_redo()} disabled={!sync.canRedo} onclick={() => sync.redo()}
							><Redo2 size={20} aria-hidden="true" /></IconButton
						>
					</div>
				{/if}
			</header>

			<div class="sticky top-0 z-map-ui -mx-5 bg-surface px-5 py-2 lg:hidden print:hidden">
				<Outline items={outline} label={m.plan_outline()} variant="chips" onpick={pick} />
			</div>

			<WorkspaceSection id="overview" title={m.plan_overview()} bind:open={open.overview}>
				{#if data.budget}
					<BudgetCard budget={data.budget} flat {editable} onsave={(budget) => patch({ budget })} />
				{/if}
				<!-- Estimate vs actual (§5): the budget card's total against the sum of logged spends. -->
				{#if data.spends.length}
					<p class="type-body" data-testid="spent">
						{data.budget
							? m.plan_spent({ spent: formatINR(spent), estimate: formatINR(data.budget.total) })
							: m.plan_spent_total({ spent: formatINR(spent) })}
					</p>
				{/if}
				<div class={block} data-testid="on-the-day">
					<h3 class="type-h3">{m.live_title()}</h3>
					<div class="flex flex-wrap gap-2">
						<Button href={resolve('/trip/live/[id]', { id: data.trip.id })}>{m.live_open()}</Button>
						<Button variant="secondary" href={`${resolve('/navigate')}?trip=${data.trip.id}&day=1`}
							>{m.live_navigate_day()}</Button
						>
					</div>
					<p class="type-small text-text-2" data-testid="offline-ready">
						{routesCached ? m.plan_offline_ready() : m.plan_offline_pending()}
					</p>
					{#if editable}<form
							method="POST"
							action="?/suggest"
							use:submitting={() =>
								async ({ update }) =>
									update({ reset: false })}
							class="flex flex-wrap items-end gap-2"
						>
							<label class="flex flex-col gap-1.5 type-small text-text-2"
								>{m.plan_days()}<select name="day" class="field h-12 px-3 type-body text-text"
									>{#each data.days as d, i (i)}<option value={i + 1}
											>{m.plan_day_n({ n: i + 1 })}{d.date ? ` · ${d.date}` : ''}</option
										>{/each}</select
								></label
							>
							<Button type="submit" variant="ghost">{m.plan_suggest_order()}</Button>
						</form>{/if}
					{#if form?.suggest}
						<div
							class="flex flex-col gap-2 rounded-md bg-surface-2 p-3"
							data-testid="order-suggestion"
						>
							{#if form.suggest.savedMin > 0}
								<p class="type-body">{m.plan_suggest_saves({ n: form.suggest.savedMin })}</p>
								<p class="type-small">{form.suggest.names.join(' → ')}</p>
								<form method="POST" action="?/applyOrder" use:submitting>
									<input type="hidden" name="day" value={form.suggest.day} />
									<Button type="submit">{m.crabby_apply()}</Button>
								</form>
							{:else}
								<p class="type-body">{m.plan_suggest_none()}</p>
							{/if}
						</div>
					{/if}
				</div>
			</WorkspaceSection>

			<WorkspaceSection id="places" title={m.plan_places()} bind:open={open.places}>
				{#each lists as l (l.id ?? 'default')}
					<TripList
						list={l}
						days={data.days.length}
						recommended={data.recommended}
						{editable}
						active={activeStop}
						onop={op}
						onmap={() => showList(l.id)}
						onpick={(it) => pickStop(it.id, l.id)}
					/>
				{/each}
				{#if editable}
					<div class="print:hidden">
						<Button
							variant="secondary"
							onclick={() => op({ op: 'list.create', title: m.plan_list_new() })}
							>{m.plan_list_new()}</Button
						>
					</div>
				{/if}
			</WorkspaceSection>

			<WorkspaceSection id="itinerary" title={m.plan_itinerary()} bind:open={open.itinerary}>
				<PlanDays
					bind:tab
					active={activeStop}
					onpick={(s) => pickStop(s.id)}
					days={data.days}
					{editable}
					links={false}
					routes={routes?.days ?? []}
					{routesLoading}
					add={data.add}
					votes={data.votes}
					onchange={moveStops}
				/>
				{#if editable && (data.voters || form?.merge)}
					<div class={block}>
						{#if data.voters}<p class="type-body" data-testid="voters">
								{m.plan_voters({ n: data.voters })}
							</p>
							<form
								method="POST"
								action="?/merge"
								use:submitting={() =>
									async ({ update }) =>
										update({ reset: false })}
							>
								<Button type="submit" variant="secondary">{m.plan_merge_votes()}</Button>
							</form>{/if}
						{#if form?.merge}
							{@const r = form.merge}
							<div
								class="flex flex-col gap-2 rounded-md bg-surface-2 p-3"
								data-testid="merge-result"
							>
								{#if r.kind === 'limit'}<p class="type-body">{m.crabby_limit()}</p>
								{:else if r.kind === 'unavailable'}<p class="type-body">{m.crabby_unavailable()}</p>
								{:else if r.kind === 'nothing'}<p class="type-body">{m.plan_merge_nothing()}</p>
								{:else if r.kind === 'merge'}
									{#if r.text}<p class="type-body">{r.text}</p>{/if}
									<p class="type-h3">{r.action.preview.title}</p>
									{#each r.action.preview.lines as l, k (k)}<p class="type-small">{l}</p>{/each}
									{#if mergeState === 'applied'}<p class="type-small" role="status">
											{m.crabby_applied()}
										</p>
									{:else if mergeState === 'discarded'}<p class="type-small" role="status">
											{m.crabby_discarded()}
										</p>
									{:else}
										<div class="flex gap-2">
											<Button onclick={() => applyMerge(r.action, true)}>{m.crabby_apply()}</Button>
											<Button variant="ghost" onclick={() => applyMerge(r.action, false)}
												>{m.crabby_discard()}</Button
											>
										</div>
									{/if}
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			</WorkspaceSection>

			<WorkspaceSection id="expenses" title={m.plan_expenses()} bind:open={open.expenses}>
				<Expenses tripmates={data.tripmates} spends={data.spends} {editable} onop={op} />
			</WorkspaceSection>

			<WorkspaceSection id="notes" title={m.plan_notes()} bind:open={open.notes}>
				<label class="flex flex-col gap-1.5 type-small text-text-2">
					{m.plan_notes_label()}
					<textarea
						rows="6"
						maxlength="20000"
						placeholder={m.plan_notes_hint()}
						readonly={!editable}
						class="field min-h-36 p-3 type-body text-text"
						value={notes}
						oninput={(e) => {
							notes = e.currentTarget.value;
							clearTimeout(notesTimer);
							notesTimer = setTimeout(flushNotes, 800);
						}}
						onblur={flushNotes}></textarea>
				</label>
			</WorkspaceSection>

			<WorkspaceSection id="publish" title={m.plan_publish_title()} bind:open={open.publish}>
				{#if data.published}
					<p class="type-body" data-testid="publish-status">{msg(`route_${data.published}`)}</p>
				{/if}
				{#if isOwner && (!data.published || data.published === 'rejected')}
					<p class="type-small text-text-2">{m.plan_publish_hint()}</p>
					<form method="POST" action="?/publish" use:submitting>
						<Button type="submit" variant="secondary">{m.plan_publish()}</Button>
					</form>
				{/if}
				{#if data.isAdmin}
					<form
						method="POST"
						action="?/readyMade"
						use:submitting
						class="flex flex-wrap items-end gap-2"
					>
						<label class="flex flex-col gap-1.5 type-small text-text-2">
							{m.plan_ready_made_slug()}
							<input
								name="slug"
								value={data.trip.slug ?? ''}
								pattern={SLUG_PATTERN}
								required
								class="field h-12 px-3 type-body text-text"
							/>
						</label>
						<Button type="submit" variant="ghost"
							>{data.trip.is_ready_made ? m.plan_save() : m.plan_make_ready_made()}</Button
						>
						{#if form?.readyMade}<span class="type-small" role="status">{m.owner_saved()}</span
							>{/if}
					</form>
				{/if}
			</WorkspaceSection>

			<div class="flex flex-wrap items-center justify-between gap-2 print:hidden">
				<a href={resolve('/plan/new')} class="inline-flex min-h-11 items-center type-body"
					>{m.plan_new()}</a
				>
				{#if isOwner}<form
						method="POST"
						action="?/delete"
						onsubmit={(e) => {
							if (!confirm(m.plan_delete_confirm())) e.preventDefault();
						}}
					>
						<Button type="submit" variant="ghost">{m.plan_delete()}</Button>
					</form>{/if}
			</div>
		</div>
	</BottomSheet>
</main>

<!-- Share sheet: always rendered (closed) so the day links stay in the page for print-free sharing and tests. -->
<dialog
	bind:this={sheet}
	aria-labelledby="share-title"
	class="mx-auto mt-auto mb-0 w-full max-w-none rounded-t-xl bg-surface p-5 pb-[calc(--spacing(5)+env(safe-area-inset-bottom))] text-text shadow-e3 backdrop:bg-(--scrim) lg:m-auto lg:max-w-105 lg:rounded-xl lg:pb-5 print:hidden"
>
	<div class="flex flex-col gap-4">
		<div class="flex items-center justify-between gap-2">
			<h2 id="share-title" class="type-h2">{m.plan_share_title()}</h2>
			<IconButton label={m.close()} onclick={() => sheet?.close()}
				><X size={20} aria-hidden="true" /></IconButton
			>
		</div>
		<div class="flex flex-col">
			<button
				type="button"
				class={row}
				onclick={() => copy(`${origin}/plan/share/${data.shareToken}`)}
				><Link size={20} aria-hidden="true" class="text-text-2" />{m.plan_share()}</button
			>
			<button
				type="button"
				class={row}
				onclick={() => copy(`${origin}/plan/vote/${data.shareToken}`)}
				><Users size={20} aria-hidden="true" class="text-text-2" />{m.plan_invite_vote()}</button
			>
			<button
				type="button"
				class={row}
				onclick={() => {
					sheet?.close();
					window.print();
				}}><FileDown size={20} aria-hidden="true" class="text-text-2" />{m.plan_pdf()}</button
			>
		</div>
		{#if isOwner}
			<div class="flex flex-col gap-2 border-t border-border pt-3" data-testid="invites">
				<h3 class="type-h3">{m.plan_invite_title()}</h3>
				<p class="type-small text-text-2">{m.plan_invite_hint()}</p>
				<div class="flex flex-col">
					<button type="button" class={row} onclick={() => copyInvite('editor')}
						><Pencil
							size={20}
							aria-hidden="true"
							class="text-text-2"
						/>{m.plan_invite_edit()}</button
					>
					<button type="button" class={row} onclick={() => copyInvite('viewer')}
						><Eye size={20} aria-hidden="true" class="text-text-2" />{m.plan_invite_view()}</button
					>
					{#if data.invites.length}
						<button type="button" class={row} onclick={revokeInvites}
							><X
								size={20}
								aria-hidden="true"
								class="text-text-2"
							/>{m.plan_invite_revoke()}</button
						>
					{/if}
				</div>
				<form class="flex flex-wrap gap-2" onsubmit={invite}>
					<input
						type="email"
						required
						maxlength="254"
						bind:value={inviteEmail}
						aria-label={m.plan_invite_email()}
						placeholder={m.plan_invite_email()}
						class="field h-11 min-w-0 flex-1 basis-48 px-3 type-body text-text"
					/>
					<select
						bind:value={inviteRole}
						aria-label={m.plan_invite_role()}
						class="field h-11 px-2 type-body text-text"
					>
						<option value="editor">{m.plan_role_editor()}</option>
						<option value="viewer">{m.plan_role_viewer()}</option>
					</select>
					<Button type="submit" variant="secondary">{m.plan_invite_send()}</Button>
				</form>
				{#if accountMates.length}
					<ul class="flex flex-col gap-1">
						{#each accountMates as t (t.id)}
							<li class="flex items-center gap-2" data-testid="account-mate">
								<span class="min-w-0 flex-1 truncate type-body">{t.name}</span>
								<select
									value={t.role}
									aria-label={m.plan_tripmate_role({ name: t.name })}
									class="field h-11 px-2 type-small text-text"
									onchange={(e) =>
										op({
											op: 'mate.role',
											id: t.id,
											role: e.currentTarget.value as 'editor' | 'viewer'
										})}
								>
									<option value="editor">{m.plan_role_editor()}</option>
									<option value="viewer">{m.plan_role_viewer()}</option>
								</select>
								<IconButton
									label={m.plan_tripmate_remove({ name: t.name })}
									onclick={() => op({ op: 'mate.remove', id: t.id })}
									><X size={20} aria-hidden="true" /></IconButton
								>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}
		{#each data.days as d, i (i)}
			{#if d.links.length}
				<div class="flex flex-col gap-2 border-t border-border pt-3">
					<h3 class="type-label text-text-2">{m.plan_day_n({ n: i + 1 })}</h3>
					<div class="flex flex-wrap gap-2" data-testid="gmaps">
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
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{/each}
					</div>
				</div>
			{/if}
		{/each}
	</div>
</dialog>
