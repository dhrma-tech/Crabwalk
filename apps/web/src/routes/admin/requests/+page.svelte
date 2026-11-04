<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import RequestReply from '#lib/components/RequestReply.svelte';
	import type { PageProps } from './$types';

	// Team: availability requests for unclaimed listings, relayed by WhatsApp (P12 step I, 10.2).
	let { data }: PageProps = $props();
</script>

<Page title={m.req_team_title()} back tool>
	<div class="mx-auto flex max-w-170 flex-col gap-4">
		<p class="type-small text-text-2">{m.req_team_hint()}</p>
		{#each data.requests as r (r.id)}
			<RequestReply {r} relay={r.relay} />
		{:else}
			<p class="type-body text-text-2">{m.req_none()}</p>
		{/each}
	</div>
</Page>
