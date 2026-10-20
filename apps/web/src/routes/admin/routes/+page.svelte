<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import PlanDays from '#lib/components/plan/PlanDays.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Page title={m.routes_title()} back>
	<div class="mx-auto flex max-w-[680px] flex-col gap-6">
		{#each data.routes as r (r.trip_id)}
			<article
				class="flex flex-col gap-3 border border-border bg-surface p-4"
				data-testid="route-review"
			>
				{#if r.view}
					<h2 class="type-h2">{r.view.trip.title}</h2>
					<p class="type-small text-text-2">
						{m.plan_n_days({ n: r.view.trip.days })}{r.view.trip.start
							? ` · ${r.view.trip.start}`
							: ''}
					</p>
					<PlanDays days={r.view.days} />
				{/if}
				<form method="POST" action="?/review" use:enhance class="flex flex-wrap gap-2">
					<input type="hidden" name="trip_id" value={r.trip_id} />
					<Button type="submit" name="status" value="approved">{m.routes_approve()}</Button>
					<Button type="submit" variant="ghost" name="status" value="rejected"
						>{m.routes_reject()}</Button
					>
				</form>
			</article>
		{:else}
			<p class="type-body text-text-2">{m.routes_empty()}</p>
		{/each}
	</div>
</Page>
