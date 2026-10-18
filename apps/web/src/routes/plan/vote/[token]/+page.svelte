<script lang="ts">
	import ThumbsUp from '@lucide/svelte/icons/thumbs-up';
	import ThumbsDown from '@lucide/svelte/icons/thumbs-down';
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import type { PageProps } from './$types';

	// No login: name + up/down per spot. Crabby merges votes for the creator in P8.
	let { data, form }: PageProps = $props();
	const opt =
		'flex min-h-11 cursor-pointer items-center gap-1.5 rounded-chip border border-border px-4 type-small has-checked:border-sea-500 has-checked:bg-sea-500 has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-sea-500';
</script>

<Page title={m.gvote_title()}>
	<form method="POST" class="mx-auto flex max-w-[680px] flex-col gap-4">
		<p class="type-body">{m.gvote_intro({ title: data.title })}</p>
		<label class="flex flex-col gap-1.5 type-small text-text-2">
			{m.gvote_name()}
			<input
				name="name"
				required
				maxlength="60"
				autocomplete="given-name"
				class="h-12 rounded-input border border-border bg-surface px-4 type-body text-text"
			/>
		</label>
		<ul class="flex flex-col gap-3">
			{#each data.spots as s (s.id)}
				<li
					class="flex flex-col gap-2 rounded-card border border-border bg-surface p-4"
					data-testid="vote-spot"
				>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href built from a known route + slug -->
					{#if s.href}<a href={s.href} class="type-h3">{s.name}</a>{:else}<span class="type-h3"
							>{s.name}</span
						>{/if}
					<fieldset class="flex flex-wrap items-center gap-2">
						<legend class="sr-only">{s.name}</legend>
						<label class={opt}
							><input type="radio" name="v:{s.id}" value="up" class="sr-only" /><ThumbsUp
								size={18}
								aria-hidden="true"
							/>{m.gvote_up()}</label
						>
						<label class={opt}
							><input type="radio" name="v:{s.id}" value="down" class="sr-only" /><ThumbsDown
								size={18}
								aria-hidden="true"
							/>{m.gvote_down()}</label
						>
						<span class="type-small text-text-2">{m.gvote_counts({ up: s.up, down: s.down })}</span>
					</fieldset>
				</li>
			{/each}
		</ul>
		{#if form?.error}<p class="type-body" role="alert">
				{form.error === 'name' ? m.gvote_need_name() : m.gvote_need_vote()}
			</p>{/if}
		{#if form?.sent}<p class="type-body" role="status">{m.gvote_sent()}</p>{/if}
		<div><Button type="submit">{m.gvote_send()}</Button></div>
	</form>
</Page>
