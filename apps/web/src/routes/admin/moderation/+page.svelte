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

<Page title={m.moderation_title()} back>
	<div class="mx-auto flex max-w-[680px] flex-col gap-4">
		{#each data.reviews as r (r.id)}
			<article
				class="flex flex-col gap-2 rounded-card border border-border bg-surface p-4"
				data-testid="pending-review"
			>
				<p class="type-small text-text-2">
					{msg(`type_${r.entity_type}`)} · {msg(`group_${r.group_type}`)} · {formatDate(
						r.created_at
					)}
				</p>
				{#if r.text}<p class="type-body whitespace-pre-line">{r.text}</p>{/if}
				{#if r.ai_flag}<p
						class={[
							'self-start rounded-chip px-3 py-0.5 type-small',
							r.ai_flag === 'flagged'
								? 'bg-laterite-100 text-laterite-900'
								: 'bg-raised text-text-2'
						]}
						data-testid="ai-flag"
					>
						{r.ai_flag === 'flagged'
							? m.moderation_ai_flagged({ reason: r.ai_reason ?? '' })
							: m.moderation_ai_ok()}
					</p>{/if}
				{#if r.photos.length}
					<div class="flex flex-wrap gap-2">
						{#each r.photos as src (src)}<img
								{src}
								alt=""
								class="size-24 rounded-input object-cover"
							/>{/each}
					</div>
				{/if}
				<form method="POST" action="?/decide" use:enhance class="flex gap-2">
					<input type="hidden" name="id" value={r.id} />
					<Button type="submit" variant="secondary" name="approve" value="1">{m.approve()}</Button>
					<Button type="submit" variant="ghost" name="approve" value="0">{m.reject()}</Button>
				</form>
			</article>
		{:else}
			<p class="type-body text-text-2">{m.moderation_empty()}</p>
		{/each}
	</div>
</Page>
