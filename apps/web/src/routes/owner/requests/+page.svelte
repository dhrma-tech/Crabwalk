<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import RequestReply from '#lib/components/RequestReply.svelte';
	import type { PageProps } from './$types';

	// Owner: availability requests for my listings (P12 step I, 10.2).
	let { data }: PageProps = $props();
</script>

<Page title={m.req_incoming()} back>
	<div class="mx-auto flex max-w-170 flex-col gap-4">
		<p class="type-small text-text-2">{m.req_owner_hint()}</p>
		{#each data.requests as r (r.id)}
			<RequestReply {r} />
		{:else}
			<p class="type-body text-text-2">{m.req_none()}</p>
		{/each}
	</div>
</Page>
