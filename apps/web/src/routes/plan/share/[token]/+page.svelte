<script lang="ts">
	import Users from '@lucide/svelte/icons/users';
	import FileDown from '@lucide/svelte/icons/file-down';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import PlanDays from '#lib/components/plan/PlanDays.svelte';
	import type { PageProps } from './$types';

	// Read-only shared plan (FRONTEND §7.10). Tideline (T-33): meta chips, the plan view's timeline with its
	// Google Maps links inline, then "Vote on the spots" and PDF.
	let { data }: PageProps = $props();
</script>

<Page title={data.trip.title}>
	<div class="mx-auto flex max-w-170 flex-col gap-6">
		<p class="flex flex-wrap gap-2">
			{#each [m.plan_n_days({ n: data.trip.days }), data.trip.start].filter(Boolean) as t (t)}
				<span
					class="inline-flex min-h-7 items-center rounded-full bg-surface-2 px-3 type-label text-text-2"
					>{t}</span
				>
			{/each}
		</p>
		<PlanDays days={data.days} />
		<div class="flex flex-wrap gap-2 print:hidden">
			<Button href={resolve('/plan/vote/[token]', { token: data.token })}>
				{#snippet icon()}<Users size={20} aria-hidden="true" />{/snippet}
				{m.plan_vote_cta()}
			</Button>
			<Button variant="secondary" onclick={() => window.print()}>
				{#snippet icon()}<FileDown size={20} aria-hidden="true" />{/snippet}
				{m.plan_pdf()}
			</Button>
		</div>
	</div>
</Page>
