<script lang="ts">
	import Share2 from '@lucide/svelte/icons/share-2';
	import Link from '@lucide/svelte/icons/link';
	import Users from '@lucide/svelte/icons/users';
	import FileDown from '@lucide/svelte/icons/file-down';
	import X from '@lucide/svelte/icons/x';
	import { submitting } from '#lib/forms.ts';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import { toast } from '#lib/toast.svelte.ts';
	import { decide, type Action } from '#lib/crabby.svelte.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import IconButton from '#lib/components/IconButton.svelte';
	import PlanDays from '#lib/components/plan/PlanDays.svelte';
	import BudgetCard from '#lib/components/plan/BudgetCard.svelte';
	import type { StripLeg } from '#lib/nav/strip.ts';
	import type { PageProps } from './$types';

	// FRONTEND §7.9: day tabs → timeline → reorder → add stay/meal → budget → share / PDF / Google Maps.
	// Tideline (Report 2 §9.8, T-32): timeline (with the day's route strip) on the left; budget, "On the day",
	// group votes and publishing on the right on laptops. Share, vote link, PDF and each day's Google Maps links
	// sit in a Share sheet.
	let { data, form }: PageProps = $props();
	let saving = $state(false);
	const SLUG_PATTERN = '[a-z0-9-]{3,60}';
	let mergeState = $state<'applied' | 'discarded' | null>(null);
	// Saved trips' routes are cached automatically for offline navigation (FRONTEND §9); the same response draws
	// each day's route strip.
	type Routes = { days: { day: number; legs: (StripLeg & { to: { name: string } })[] }[] };
	let routes = $state<Routes | null>(null);
	let routesCached = $state(false);
	$effect(() => {
		void data.days;
		fetch(`/api/trips/${data.trip.id}/routes`)
			.then(async (r) => {
				routesCached = r.ok;
				routes = r.ok ? ((await r.json()) as Routes) : null;
			})
			.catch(() => (routesCached = false));
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
	const card = 'flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-e1 print:hidden';
	const row =
		'row-link flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-left type-body text-text no-underline';
</script>

<Page title={data.trip.title} back heading={false}>
	<div class="flex flex-col gap-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-10">
		<div class="flex flex-col gap-6 lg:col-span-7">
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

			<PlanDays
				days={data.days}
				editable
				links={false}
				routes={routes?.days ?? []}
				add={data.add}
				votes={data.votes}
				onchange={(days) => patch({ days })}
			/>
		</div>

		<div class="flex flex-col gap-6 lg:col-span-5">
			{#if data.budget}
				<BudgetCard budget={data.budget} editable onsave={(budget) => patch({ budget })} />
			{/if}

			<section class={card} data-testid="on-the-day">
				<h2 class="type-h2">{m.live_title()}</h2>
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
			</section>

			{#if data.voters || form?.merge}
				<section class={card}>
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
						<div class="flex flex-col gap-2 rounded-md bg-surface-2 p-3" data-testid="merge-result">
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
				</section>
			{/if}

			<section class={card}>
				<h2 class="type-h3">{m.plan_publish_title()}</h2>
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
			</section>

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
	</div>
</Page>

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
