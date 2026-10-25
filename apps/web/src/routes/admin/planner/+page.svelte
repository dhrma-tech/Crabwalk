<script lang="ts">
	import { submitting } from '#lib/forms.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const field = 'h-11 w-28 border-b border-text bg-bg type-body text-text';
</script>

<Page title={m.planner_settings()} back>
	<form
		method="POST"
		action="?/save"
		use:submitting
		class="mx-auto flex max-w-[680px] flex-col gap-6"
	>
		<section class="flex flex-col gap-3">
			<h2 class="type-h2">{m.budget_fuel()}</h2>
			<p class="type-small text-text-2">{m.planner_fuel_hint()}</p>
			<label class="flex items-center justify-between gap-3 type-body"
				>{m.budget_fuel_price()}<input
					name="fuel_price_inr"
					type="number"
					step="0.01"
					min="0"
					value={data.fuelPrice ?? ''}
					class={field}
				/></label
			>
			<label class="flex items-center justify-between gap-3 type-body"
				>{m.budget_mileage()}<input
					name="default_mileage_kmpl"
					type="number"
					step="0.1"
					min="1"
					value={data.mileage ?? ''}
					class={field}
				/></label
			>
		</section>
		<section class="flex flex-col gap-3">
			<h2 class="type-h2">{m.planner_visit_minutes()}</h2>
			{#each data.cats as c (c.category)}
				<label class="flex items-center justify-between gap-3 type-body"
					>{msg(`cat_${c.category}`)}<input
						name="min_{c.category}"
						type="number"
						min="10"
						max="600"
						step="5"
						value={c.minutes}
						required
						class={field}
					/></label
				>
			{/each}
		</section>
		{#if form?.saved}<p class="type-small" role="status">{m.owner_saved()}</p>{/if}
		{#if form?.error}<p class="type-small" role="alert">{m.send_failed()}</p>{/if}
		<div><Button type="submit">{m.qr_admin_save()}</Button></div>
	</form>
</Page>
