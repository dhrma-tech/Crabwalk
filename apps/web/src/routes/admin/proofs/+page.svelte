<script lang="ts">
	import { submitting } from '#lib/forms.ts';
	import { s } from '#lib/staff-messages.ts';
	import { msg } from '#lib/msg.ts';
	import { formatDate } from '#lib/format.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Page title={s.proofs_title()} back>
	<div class="mx-auto flex max-w-170 flex-col gap-4">
		{#each data.proofs as p (p.id)}
			<article
				class="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-e1"
				data-testid="pending-proof"
			>
				<p class="type-h3">
					{p.name} ·
					<span class="type-small text-text-2"
						>{msg(`type_${p.type}`)} · {formatDate(p.created_at)}</span
					>
				</p>
				{#if p.url}<img src={p.url} alt="" class="max-h-80 object-contain" />{/if}
				<form method="POST" action="?/decide" use:submitting class="flex gap-2">
					<input type="hidden" name="id" value={p.id} />
					<Button type="submit" variant="secondary" name="approve" value="1">{s.approve()}</Button>
					<Button type="submit" variant="ghost" name="approve" value="0">{s.reject()}</Button>
				</form>
			</article>
		{:else}
			<p class="type-body text-text-2">{s.proofs_empty()}</p>
		{/each}
	</div>
</Page>
