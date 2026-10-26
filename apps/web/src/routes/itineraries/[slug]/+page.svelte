<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import PlanDays from '#lib/components/plan/PlanDays.svelte';
	import BudgetCard from '#lib/components/plan/BudgetCard.svelte';
	import type { PageProps } from './$types';
	import { page } from '$app/state';
	import { loginHref } from '#lib/login.ts';

	// A ready-made / community itinerary (P7). Tideline (T-30): reading column, the "use it" form on a card. The
	// day list and budget card are the plan view's components (restyled with the plan view).
	let { data }: PageProps = $props();
</script>

<Page title={data.trip.title} back description={m.meta_itineraries()}>
	<div class="mx-auto flex max-w-170 flex-col gap-8">
		<p class="flex flex-wrap gap-2">
			{#each [m.plan_n_days( { n: data.trip.days } ), data.trip.start, data.trip.is_ready_made ? m.itin_ready_made() : m.itin_community()].filter(Boolean) as t (t)}
				<span
					class="inline-flex min-h-7 items-center rounded-full bg-surface-2 px-3 type-label text-text-2"
					>{t}</span
				>
			{/each}
		</p>
		<PlanDays days={data.days} />
		{#if data.budget}<BudgetCard budget={data.budget} />{/if}
		<section class="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-e1 print:hidden">
			{#if data.signedIn}
				<form method="POST" action="?/copy" class="flex flex-wrap items-end gap-3">
					<label class="flex min-w-48 flex-1 flex-col gap-1.5 type-small text-text-2">
						{m.plan_start_date()}
						<input
							type="date"
							name="start_date"
							value={data.tomorrow}
							min={data.tomorrow}
							required
							class="field h-12 px-4 type-body text-text"
						/>
					</label>
					<Button type="submit">{m.itin_use()}</Button>
				</form>
			{:else}
				<div><Button href={loginHref(page.url)}>{m.itin_signin()}</Button></div>
			{/if}
		</section>
	</div>
</Page>
