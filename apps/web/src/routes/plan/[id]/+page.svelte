<script lang="ts">
	import Share2 from '@lucide/svelte/icons/share-2';
	import Link from '@lucide/svelte/icons/link';
	import Users from '@lucide/svelte/icons/users';
	import FileDown from '@lucide/svelte/icons/file-down';
	import X from '@lucide/svelte/icons/x';
	import { onMount, tick } from 'svelte';
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
	import type { StripLeg } from '#lib/nav/strip.ts';
	import type { PageProps } from './$types';

	// FRONTEND §7.9: day tabs → timeline → reorder → add stay/meal → budget → share / PDF / Google Maps.
	// P11 workspace (docs/P11 Plan workspace.md §2–§3): laptops = outline · sections column · map; phones = map
	// on top with the sections in a bottom sheet. Sections fold; the outline unfolds and scrolls to one. Share,
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
	function pickStop(id: string) {
		activeStop = id;
		if (!wide && snap === 'full') snap = 'half';
	}
	async function showStop(id: string) {
		activeStop = id;
		open.itinerary = true;
		if (!wide && snap === 'peek') snap = 'half';
		await tick();
		document.getElementById(`stop-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}

	const open = $state({ overview: true, itinerary: true, publish: true });
	const allOpen = $derived(Object.values(open).every(Boolean));
	function toggleAll() {
		const to = !allOpen;
		for (const k of Object.keys(open) as (keyof typeof open)[]) open[k] = to;
	}
	const outline = $derived<OutlineItem[]>([
		{ id: 'overview', label: m.plan_overview(), section: 'overview' },
		{ id: 'itinerary', label: m.plan_itinerary(), section: 'itinerary' },
		...data.days.map((_, i) => ({
			id: `day-${i}`, // PlanDays' panel id
			label: m.plan_day_n({ n: i + 1 }),
			section: 'itinerary',
			sub: true
		})),
		{ id: 'publish', label: m.plan_publish_title(), section: 'publish' }
	]);
	async function pick(item: OutlineItem) {
		open[item.section as keyof typeof open] = true;
		if (item.sub) tab = Number(item.id.slice(4));
		if (!wide && snap !== 'full') snap = 'full';
		await tick();
		document.getElementById(item.section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
	let saving = $state(false);
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

	// Edits are saved in order: each PATCH carries the full latest order, so a queue avoids races.
	let queue: Promise<void> = Promise.resolve();
	function patch(body: unknown) {
		saving = true;
		queue = queue.then(async () => {
			const res = await fetch(`/api/trips/${data.trip.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			}).catch(() => null);
			if (!res?.ok) toast(m.send_failed());
			await invalidateAll();
			saving = false;
		});
	}
	async function copy(text: string) {
		await navigator.clipboard?.writeText(text).catch(() => {});
		toast(m.plan_link_copied());
	}
	let sheet: HTMLDialogElement | undefined = $state();
	const block = 'flex flex-col gap-3 rounded-md bg-surface-2 p-4 print:hidden';
	const row =
		'row-link flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-left type-body text-text no-underline';
</script>

<svelte:window bind:innerHeight />

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
				stops={dayStops}
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
					{#if saving}<span class="type-small text-text-2" role="status">{m.plan_updating()}</span
						>{/if}
				</p>
			</header>

			<div class="sticky top-0 z-map-ui -mx-5 bg-surface px-5 py-2 lg:hidden print:hidden">
				<Outline items={outline} label={m.plan_outline()} variant="chips" onpick={pick} />
			</div>

			<WorkspaceSection id="overview" title={m.plan_overview()} bind:open={open.overview}>
				{#if data.budget}
					<BudgetCard budget={data.budget} flat editable onsave={(budget) => patch({ budget })} />
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
					<form
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
					</form>
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

			<WorkspaceSection id="itinerary" title={m.plan_itinerary()} bind:open={open.itinerary}>
				<PlanDays
					bind:tab
					active={activeStop}
					onpick={(s) => pickStop(s.id)}
					days={data.days}
					editable
					links={false}
					routes={routes?.days ?? []}
					{routesLoading}
					add={data.add}
					votes={data.votes}
					onchange={(days) => patch({ days })}
				/>
				{#if data.voters || form?.merge}
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

			<WorkspaceSection id="publish" title={m.plan_publish_title()} bind:open={open.publish}>
				{#if data.published}
					<p class="type-body" data-testid="publish-status">{msg(`route_${data.published}`)}</p>
				{/if}
				{#if !data.published || data.published === 'rejected'}
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
				<form
					method="POST"
					action="?/delete"
					onsubmit={(e) => {
						if (!confirm(m.plan_delete_confirm())) e.preventDefault();
					}}
				>
					<Button type="submit" variant="ghost">{m.plan_delete()}</Button>
				</form>
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
