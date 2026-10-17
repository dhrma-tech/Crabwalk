<script lang="ts">
	import { SUPABASE_URL } from '$app/env/public';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { msg } from '#lib/msg.ts';
	import { formatDate } from '#lib/format.ts';

	// Approved reviews only (moderated). Summary appears once P8 generates it.
	let {
		reviews,
		summaries
	}: {
		reviews: {
			id: string;
			group_type: string;
			text: string | null;
			created_at: string;
			review_photos: { id: string; storage_path: string; lqip: string | null }[];
		}[];
		summaries: { lang: string; summary: string }[];
	} = $props();
	const summary = $derived(summaries.find((s) => s.lang === getLocale())?.summary ?? null);
	const url = (p: string) => `${SUPABASE_URL}/storage/v1/object/public/review-photos/${p}-480.webp`;
</script>

<section class="flex flex-col gap-3" data-testid="reviews">
	<h2 class="type-h2">{m.reviews_title()}</h2>
	{#if summary}<p class="rounded-card bg-sea-50 p-3 type-body text-sea-900">
			<strong>{m.review_summary()}:</strong>
			{summary}
		</p>{/if}
	{#each reviews as r (r.id)}
		<article class="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
			<p class="type-small text-text-2">
				{msg(`group_${r.group_type}`)} · {formatDate(r.created_at)}
			</p>
			{#if r.text}<p class="type-body whitespace-pre-line">{r.text}</p>{/if}
			{#if r.review_photos.length}
				<div class="flex flex-wrap gap-2">
					{#each r.review_photos as p (p.id)}
						<img
							src={url(p.storage_path)}
							alt=""
							loading="lazy"
							class="size-24 rounded-input bg-cover object-cover"
							style:background-image={p.lqip ? `url(${p.lqip})` : undefined}
						/>
					{/each}
				</div>
			{/if}
		</article>
	{:else}
		<p class="type-body text-text-2">{m.reviews_none()}</p>
	{/each}
</section>
