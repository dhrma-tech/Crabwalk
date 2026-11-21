<script lang="ts">
	import { submitting } from '#lib/forms.ts';
	import { s } from '#lib/staff-messages.ts';
	import { msg } from '#lib/msg.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Page title={s.claims_title()} back>
	<div class="mx-auto flex max-w-170 flex-col gap-4">
		<p class="type-small text-text-2">{s.claim_call_first()}</p>
		{#each data.claims as c (c.id)}
			<article class="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-e1">
				<p class="type-h3">
					{c.name} · <span class="type-small text-text-2">{msg(`type_${c.type}`)}</span>
				</p>
				<p class="type-small">
					{c.email}{#if c.phone}
						· <a href={`tel:${c.phone}`}>{c.phone}</a>{/if}
				</p>
				<form method="POST" action="?/review" use:submitting class="flex gap-2">
					<input type="hidden" name="id" value={c.id} />
					<Button type="submit" variant="secondary" name="approve" value="1">{s.approve()}</Button>
					<Button type="submit" variant="ghost" name="approve" value="0">{s.reject()}</Button>
				</form>
			</article>
		{:else}
			<p class="type-body text-text-2">{s.claims_empty()}</p>
		{/each}
	</div>
</Page>
