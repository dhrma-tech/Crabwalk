<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import { toast } from '#lib/toast.svelte.ts';
	import { decide, type Action } from '#lib/crabby.svelte.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import PlanDays from '#lib/components/plan/PlanDays.svelte';
	import BudgetCard from '#lib/components/plan/BudgetCard.svelte';
	import type { PageProps } from './$types';

	// FRONTEND §7.9: day tabs → timeline → reorder → add stay/meal → budget → share / PDF / Google Maps.
	let { data, form }: PageProps = $props();
	let saving = $state(false);
	const SLUG_PATTERN = '[a-z0-9-]{3,60}';
	let mergeState = $state<'applied' | 'discarded' | null>(null);
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
</script>

<Page title={data.trip.title} back>
	<div class="mx-auto flex max-w-[680px] flex-col gap-6">
		<header class="flex flex-col gap-2">
			<form method="POST" action="?/rename" use:enhance class="flex gap-2 print:hidden">
				<label class="sr-only" for="trip-title">{m.plan_rename()}</label>
				<input
					id="trip-title"
					name="title"
					value={data.trip.title}
					maxlength="120"
					class="h-12 flex-1 rounded-input border border-border bg-surface px-4 type-h3 text-text"
				/>
				<Button type="submit" variant="secondary">{m.plan_save()}</Button>
			</form>
			<h1 class="hidden type-h1 print:block">{data.trip.title}</h1>
			<p class="type-small text-text-2">
				{m.plan_n_days({ n: data.trip.days })}{data.trip.start ? ` · ${data.trip.start}` : ''} · {msg(
					`pace_${data.trip.pace}`
				)}
				{#if saving}· <span role="status">{m.plan_updating()}</span>{/if}
			</p>
		</header>

		<PlanDays
			days={data.days}
			editable
			add={data.add}
			votes={data.votes}
			onchange={(days) => patch({ days })}
		/>

		{#if data.budget}
			<BudgetCard budget={data.budget} editable onsave={(budget) => patch({ budget })} />
		{/if}

		<section class="flex flex-col gap-3 print:hidden">
			<h2 class="type-h2">{m.plan_share_title()}</h2>
			<div class="flex flex-wrap gap-2">
				<Button variant="secondary" onclick={() => copy(`${origin}/plan/share/${data.shareToken}`)}
					>{m.plan_share()}</Button
				>
				<Button variant="secondary" onclick={() => copy(`${origin}/plan/vote/${data.shareToken}`)}
					>{m.plan_invite_vote()}</Button
				>
				<Button variant="ghost" onclick={() => window.print()}>{m.plan_pdf()}</Button>
			</div>
			{#if data.voters}<p class="type-small text-text-2" data-testid="voters">
					{m.plan_voters({ n: data.voters })}
				</p>
				<form
					method="POST"
					action="?/merge"
					use:enhance={() =>
						async ({ update }) =>
							update({ reset: false })}
				>
					<Button type="submit" variant="secondary">{m.plan_merge_votes()}</Button>
				</form>{/if}
			{#if form?.merge}
				{@const r = form.merge}
				<div
					class="flex flex-col gap-2 rounded-card border border-border bg-surface p-3"
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
		</section>

		<section class="flex flex-col gap-2 print:hidden">
			<h2 class="type-h3">{m.plan_publish_title()}</h2>
			{#if data.published}
				<p class="type-body" data-testid="publish-status">{msg(`route_${data.published}`)}</p>
			{/if}
			{#if !data.published || data.published === 'rejected'}
				<p class="type-small text-text-2">{m.plan_publish_hint()}</p>
				<form method="POST" action="?/publish" use:enhance>
					<Button type="submit" variant="secondary">{m.plan_publish()}</Button>
				</form>
			{/if}
			{#if data.isAdmin}
				<form method="POST" action="?/readyMade" use:enhance class="flex flex-wrap items-end gap-2">
					<label class="flex flex-col gap-1 type-small text-text-2">
						{m.plan_ready_made_slug()}
						<input
							name="slug"
							value={data.trip.slug ?? ''}
							pattern={SLUG_PATTERN}
							required
							class="h-12 rounded-input border border-border bg-surface px-3 type-body text-text"
						/>
					</label>
					<Button type="submit" variant="ghost"
						>{data.trip.is_ready_made ? m.plan_save() : m.plan_make_ready_made()}</Button
					>
					{#if form?.readyMade}<span class="type-small" role="status">{m.owner_saved()}</span>{/if}
				</form>
			{/if}
		</section>

		<form
			method="POST"
			action="?/delete"
			class="print:hidden"
			onsubmit={(e) => {
				if (!confirm(m.plan_delete_confirm())) e.preventDefault();
			}}
		>
			<Button type="submit" variant="ghost">{m.plan_delete()}</Button>
		</form>
		<p class="print:hidden"><a href={resolve('/plan/new')} class="type-body">{m.plan_new()}</a></p>
	</div>
</Page>
