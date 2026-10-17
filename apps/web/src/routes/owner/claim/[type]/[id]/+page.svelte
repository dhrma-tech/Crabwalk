<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<Page title={m.claim_title()} back>
	<div class="mx-auto flex max-w-[680px] flex-col gap-4">
		<h2 class="type-h1">{data.name}</h2>
		{#if form?.sent}
			<p class="type-body" role="status">{m.claim_sent()}</p>
		{:else}
			<p class="type-body">{m.claim_body()}</p>
			{#if form?.error}<p class="type-small" role="alert">{m.send_failed()}</p>{/if}
			<form method="POST" use:enhance><Button type="submit">{m.claim_send()}</Button></form>
		{/if}
	</div>
</Page>
