<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import { formatDate } from '#lib/format.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Page title={m.proofs_title()} back>
	<div class="mx-auto flex max-w-[680px] flex-col gap-4">
		{#each data.proofs as p (p.id)}
			<article
				class="flex flex-col gap-2 border border-border bg-surface p-4"
				data-testid="pending-proof"
			>
				<p class="type-h3">
					{p.name} ·
					<span class="type-small text-text-2"
						>{msg(`type_${p.type}`)} · {formatDate(p.created_at)}</span
					>
				</p>
				{#if p.url}<img src={p.url} alt="" class="max-h-80 object-contain" />{/if}
				<form method="POST" action="?/decide" use:enhance class="flex gap-2">
					<input type="hidden" name="id" value={p.id} />
					<Button type="submit" variant="secondary" name="approve" value="1">{m.approve()}</Button>
					<Button type="submit" variant="ghost" name="approve" value="0">{m.reject()}</Button>
				</form>
			</article>
		{:else}
			<p class="type-body text-text-2">{m.proofs_empty()}</p>
		{/each}
	</div>
</Page>
