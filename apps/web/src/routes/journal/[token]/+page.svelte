<script lang="ts">
	import FileDown from '@lucide/svelte/icons/file-down';
	import { SUPABASE_URL } from '$app/env/public';
	import { m } from '#lib/paraglide/messages.js';
	import { formatDate } from '#lib/format.ts';
	import Meta from '#lib/components/Meta.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import Button from '#lib/components/Button.svelte';
	import type { PageProps } from './$types';

	// A shared trip journal (P12 step M): read-only, only while its owner keeps the link on.
	let { data }: PageProps = $props();
	const j = $derived(data.journal);
</script>

<Meta title={`${j.title} · ${m.journal_title()}`} />
<TopBar title={m.journal_title()} />
<main
	id="main"
	class="mx-auto flex w-full max-w-190 flex-col gap-6 px-5 py-6"
	data-testid="journal-shared-page"
>
	<header class="flex flex-col gap-1">
		<h1 class="type-h1">{j.title}</h1>
		<p class="type-small text-text-2">{formatDate(j.updated_at)}</p>
	</header>
	<p class="type-body whitespace-pre-line" lang={j.lang}>{j.story}</p>
	{#if j.photos.length}
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
			{#each j.photos as p (p.path)}
				<img
					src={`${SUPABASE_URL}/storage/v1/object/public/journal/${p.path}`}
					alt={p.caption ?? ''}
					class="aspect-square w-full rounded-md object-cover"
				/>
			{/each}
		</div>
	{/if}
	<div class="print:hidden">
		<Button variant="secondary" onclick={() => window.print()}>
			{#snippet icon()}<FileDown size={20} aria-hidden="true" />{/snippet}{m.plan_pdf()}
		</Button>
	</div>
</main>
