<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import PlanDays from '#lib/components/plan/PlanDays.svelte';
	import BudgetCard from '#lib/components/plan/BudgetCard.svelte';
	import type { PageProps } from './$types';
	import { page } from '$app/state';
	import { loginHref } from '#lib/login.ts';

	let { data }: PageProps = $props();
</script>

<Page title={data.trip.title} back>
	<div class="mx-auto flex max-w-[680px] flex-col gap-6">
		<p class="type-small text-text-2">
			{m.plan_n_days({ n: data.trip.days })}{data.trip.start ? ` · ${data.trip.start}` : ''} · {data
				.trip.is_ready_made
				? m.itin_ready_made()
				: m.itin_community()}
		</p>
		<PlanDays days={data.days} />
		{#if data.budget}<BudgetCard budget={data.budget} />{/if}
		<section class="flex flex-col gap-2 print:hidden">
			{#if data.signedIn}
				<form method="POST" action="?/copy" class="flex flex-wrap items-end gap-2">
					<label class="flex flex-col gap-1 type-small text-text-2">
						{m.plan_start_date()}
						<input
							type="date"
							name="start_date"
							value={data.tomorrow}
							min={data.tomorrow}
							required
							class="h-11 border-b border-text bg-bg type-body text-text"
						/>
					</label>
					<Button type="submit">{m.itin_use()}</Button>
				</form>
			{:else}
				<Button href={loginHref(page.url)}>{m.itin_signin()}</Button>
			{/if}
		</section>
	</div>
</Page>
