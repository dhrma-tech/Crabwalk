<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Page title={m.owner_title()} back>
	<div class="mx-auto flex max-w-[680px] flex-col gap-4">
		{#if data.pending}<p class="bg-yama p-3 type-small text-text">
				{m.claim_pending()}
			</p>{/if}
		{#each data.listings as l (l.id)}
			<a
				href={resolve('/owner/[type]/[id]', { type: l.type, id: l.id })}
				class="flex justify-between gap-3 border border-border bg-surface px-4 py-3 text-text no-underline"
			>
				<span class="type-body">{l.name}</span><span class="type-small text-link"
					>{m.owner_edit()}</span
				>
			</a>
		{:else}
			<p class="type-body text-text-2">{m.owner_none()}</p>
		{/each}
		<p class="type-small text-text-2">{m.owner_ratings_readonly()}</p>
	</div>
</Page>
