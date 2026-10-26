<script lang="ts">
	import ThumbsUp from '@lucide/svelte/icons/thumbs-up';
	import ThumbsDown from '@lucide/svelte/icons/thumbs-down';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import Illustration from '#lib/components/Illustration.svelte';
	import type { PageProps } from './$types';

	// No login: name + up/down per spot (a plain POST form, works without JS). Crabby merges votes for the creator
	// in P8. Tideline (Report 1 §4.6, T-33): counts update as you pick (with JS), the send button reads "Done, send
	// to organiser" in the thumb zone, and sending ends on a clear done card.
	let { data, form }: PageProps = $props();
	let picks = $state<Record<string, 'up' | 'down'>>({});
	const opt =
		'flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-4 type-label text-text-2 transition-colors duration-200 has-checked:bg-text has-checked:text-bg has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus';
</script>

<Page title={m.gvote_title()}>
	{#if form?.sent}
		<section
			class="mx-auto flex max-w-170 flex-col items-center gap-3 py-8 text-center"
			data-testid="vote-done"
		>
			<Illustration name="crab" />
			<h2 class="type-h2" role="status">{m.gvote_sent()}</h2>
			<p class="type-body text-text-2">{m.gvote_done_body()}</p>
			<Button href={resolve('/plan/share/[token]', { token: page.params.token! })}
				>{m.gvote_see_plan()}</Button
			>
		</section>
		<!-- Where the group stands now (the reloaded counts include this vote). -->
		<ul
			class="mx-auto flex max-w-170 flex-col divide-y divide-border rounded-lg bg-surface shadow-e1"
		>
			{#each data.spots as s (s.id)}
				<li class="flex items-center justify-between gap-3 px-4 py-3" data-testid="vote-spot">
					<span class="type-body">{s.name}</span>
					<span class="shrink-0 type-small text-text-2 tabular-nums"
						>{m.gvote_counts({ up: s.up, down: s.down })}</span
					>
				</li>
			{/each}
		</ul>
	{:else}
		<form
			method="POST"
			class="mx-auto flex min-h-[calc(100dvh-var(--bar-h)-var(--nav-h)-3rem)] max-w-170 flex-col gap-5 lg:min-h-0"
		>
			<p class="type-lead">{m.gvote_intro({ title: data.title })}</p>
			<label class="flex flex-col gap-1.5 type-small text-text-2">
				{m.gvote_name()}
				<input
					name="name"
					required
					maxlength="60"
					autocomplete="given-name"
					class="field h-13 px-4 type-body text-text"
				/>
			</label>
			<ul class="flex flex-1 flex-col gap-3">
				{#each data.spots as s (s.id)}
					{@const up = s.up + (picks[s.id] === 'up' ? 1 : 0)}
					{@const down = s.down + (picks[s.id] === 'down' ? 1 : 0)}
					<li
						class="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-e1"
						data-testid="vote-spot"
					>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href built from a known route + slug -->
						{#if s.href}<a href={s.href} class="type-h3 text-text">{s.name}</a>{:else}<span
								class="type-h3">{s.name}</span
							>{/if}
						<fieldset class="flex gap-1 rounded-full bg-surface-2 p-0.5">
							<legend class="sr-only">{s.name}</legend>
							<label class={opt}
								><input
									type="radio"
									name="v:{s.id}"
									value="up"
									class="sr-only"
									onchange={() => (picks[s.id] = 'up')}
								/><ThumbsUp size={18} aria-hidden="true" />{m.gvote_up()}</label
							>
							<label class={opt}
								><input
									type="radio"
									name="v:{s.id}"
									value="down"
									class="sr-only"
									onchange={() => (picks[s.id] = 'down')}
								/><ThumbsDown size={18} aria-hidden="true" />{m.gvote_down()}</label
							>
						</fieldset>
						<div class="flex items-center gap-3">
							{#if up + down}
								<span
									class="flex h-1.5 flex-1 gap-0.5 overflow-hidden rounded-full"
									aria-hidden="true"
								>
									{#if up}<span class="bg-ok" style:flex-grow={up}></span>{/if}
									{#if down}<span class="bg-border-strong" style:flex-grow={down}></span>{/if}
								</span>
							{/if}
							<span class="type-small text-text-2 tabular-nums" aria-live="polite"
								>{m.gvote_counts({ up, down })}</span
							>
						</div>
					</li>
				{/each}
			</ul>
			{#if form?.error}<p class="type-body" role="alert">
					{form.error === 'name' ? m.gvote_need_name() : m.gvote_need_vote()}
				</p>{/if}
			<!-- Thumb zone: pinned above the phone nav. -->
			<div
				class="sticky bottom-(--nav-h) -mx-5 bg-bg px-5 py-3 lg:static lg:mx-0 lg:px-0 [&>*]:w-full lg:[&>*]:w-auto"
			>
				<Button type="submit">{m.gvote_done()}</Button>
			</div>
		</form>
	{/if}
</Page>
