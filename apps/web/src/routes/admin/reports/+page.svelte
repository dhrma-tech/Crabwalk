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

<Page title={m.reports_title()} back>
	<div class="mx-auto flex max-w-[680px] flex-col gap-4">
		{#if data.reports.length}
			{#each data.reports as r (r.id)}
				<article
					class="flex flex-col gap-2 border border-border bg-surface p-4"
					data-testid="report"
				>
					<p class="type-h3">
						{msg(`report_type_${r.type}`)} ·
						<span class="type-small text-text-2"
							>{msg(`report_status_${r.status}`)} · {formatDate(r.created_at)}</span
						>
					</p>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href built from a known route + slug -->
					{#if r.target}<a href={r.target.href} class="type-body">{r.target.name}</a>{/if}
					{#if r.qr_code}<p class="type-small text-text-2">QR {r.qr_code}</p>{/if}
					{#if r.text}<p class="type-body whitespace-pre-line">{r.text}</p>{/if}
					<form method="POST" action="?/status" use:enhance class="flex flex-wrap gap-2">
						<input type="hidden" name="id" value={r.id} />
						{#each ['triaged', 'fixed', 'rejected'] as s (s)}
							<Button
								type="submit"
								variant={s === 'fixed' ? 'secondary' : 'ghost'}
								name="status"
								value={s}>{msg(`report_status_${s}`)}</Button
							>
						{/each}
					</form>
				</article>
			{/each}
		{:else}
			<p class="type-body text-text-2">{m.reports_empty()}</p>
		{/if}
	</div>
</Page>
