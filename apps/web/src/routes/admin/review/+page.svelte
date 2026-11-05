<script lang="ts">
	import { resolve } from '$app/paths';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import Input from '#lib/components/Input.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<Page title={m.review_title()} back tool>
	<div class="mx-auto flex max-w-170 flex-col gap-4">
		{#if data.items.length}
			<ul
				class="divide-y divide-border overflow-hidden rounded-lg bg-surface shadow-e1"
				data-testid="review-queue"
			>
				{#each data.items as it (it.id)}
					<li>
						<a
							href={resolve('/admin/review/[type]/[id]', { type: it.type, id: it.id })}
							class="row-link flex min-h-14 items-center gap-3 px-4 py-2.5 text-text no-underline"
						>
							<span class="min-w-0 flex-1 type-body-strong">{it.name}</span>{#if it.check}<span
									class="rounded-full bg-alphonso-50 px-2 py-0.5 type-label text-alphonso-ink"
									>{m.review_check_first()}</span
								>{/if}<span class="type-small text-text-2">{msg(`type_${it.type}`)}</span
							><ChevronRight size={18} class="shrink-0 text-text-2" aria-hidden="true" />
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="type-body text-text-2">{m.review_empty()}</p>
		{/if}

		<section class="flex flex-col gap-3">
			<h2 class="type-h2">{m.taste_title()}</h2>
			<ul class="flex flex-wrap gap-2">
				{#each data.dishes as d (d.id)}
					<li>
						<a
							href={resolve('/admin/review/[type]/[id]', { type: 'dish', id: d.id })}
							class="row-link inline-flex min-h-11 items-center rounded-full border border-border px-4 type-label text-text no-underline"
							>{d.name ?? d.slug}</a
						>
					</li>
				{/each}
			</ul>
			<form method="POST" action="?/dish" class="flex flex-wrap items-end gap-3">
				<div class="flex-1">
					<Input
						id="slug"
						name="slug"
						label={m.dish_slug()}
						required
						pattern="[a-z][a-z0-9_\-]+"
						error={form?.dishError ? m.send_failed() : null}
					/>
				</div>
				<Button type="submit" variant="secondary">{m.new_dish()}</Button>
			</form>
		</section>
	</div>
</Page>
