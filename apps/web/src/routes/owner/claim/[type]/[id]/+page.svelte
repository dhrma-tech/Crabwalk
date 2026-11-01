<script lang="ts">
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import { submitting } from '#lib/forms.ts';
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<Page title={m.claim_title()} back>
	<!-- Tideline tool variant (T-40): one surface card; the sent state is an ok-50 card. -->
	<div class="mx-auto flex max-w-170 flex-col gap-4 rounded-lg bg-surface p-5 shadow-e1">
		<h2 class="type-h2 break-words">{data.name}</h2>
		{#if form?.sent}
			<p class="flex gap-2.5 rounded-md bg-ok-50 p-3 type-body text-text" role="status">
				<CircleCheck size={20} class="mt-0.5 shrink-0" aria-hidden="true" />{m.claim_sent()}
			</p>
		{:else}
			<p class="type-body">{m.claim_body()}</p>
			{#if form?.error}<p class="rounded-md bg-danger-50 p-3 type-small text-text" role="alert">
					{m.send_failed()}
				</p>{/if}
			<form method="POST" use:submitting><Button type="submit">{m.claim_send()}</Button></form>
		{/if}
	</div>
</Page>
