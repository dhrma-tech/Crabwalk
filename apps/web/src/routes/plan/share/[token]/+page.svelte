<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import PlanDays from '#lib/components/plan/PlanDays.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Page title={data.trip.title}>
	<div class="mx-auto flex max-w-[680px] flex-col gap-6">
		<p class="type-small text-text-2">
			{m.plan_n_days({ n: data.trip.days })}{data.trip.start ? ` · ${data.trip.start}` : ''}
		</p>
		<PlanDays days={data.days} />
		<div class="flex flex-wrap gap-2 print:hidden">
			<Button href={resolve('/plan/vote/[token]', { token: data.token })} variant="secondary"
				>{m.plan_vote_cta()}</Button
			>
			<Button variant="ghost" onclick={() => window.print()}>{m.plan_pdf()}</Button>
		</div>
	</div>
</Page>
