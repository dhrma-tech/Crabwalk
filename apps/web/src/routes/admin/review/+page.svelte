<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import Input from '#lib/components/Input.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<Page title={m.review_title()} back>
	<div class="mx-auto flex max-w-[680px] flex-col gap-6">
		{#if data.items.length}
			<ul
				class="flex flex-col divide-y divide-border border-t border-text"
				data-testid="review-queue"
			>
				{#each data.items as it (it.id)}
					<li>
						<a
							href={resolve('/admin/review/[type]/[id]', { type: it.type, id: it.id })}
							class="row-link flex justify-between gap-3 py-3 text-text no-underline"
						>
							<span class="type-body">{it.name}</span><span class="type-small text-text-2"
								>{msg(`type_${it.type}`)}</span
							>
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
							class="inline-flex min-h-11 items-center border border-text px-4 type-small text-text no-underline hover:bg-text/5"
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
