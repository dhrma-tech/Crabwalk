<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import type { Action } from '#lib/crabby.svelte.ts';
	import Button from '../Button.svelte';

	// FRONTEND §6.7 / Report 2 §8: what Crabby proposes, nothing changes before Apply. A surface card with a kokum
	// edge; change lines read like a diff (+ added, − removed, ↔ moved), the marker coloured and kept as text.
	let { action: a, onact }: { action: Action; onact: (apply: boolean) => void } = $props();
	const marks: Record<string, string> = { '+': 'text-ok', '−': 'text-danger', '↔': 'text-lagoon' };
	const split = (l: string) => {
		const k = l.slice(0, 1);
		return marks[k] && l[1] === ' ' ? { mark: k, cls: marks[k], rest: l.slice(2) } : null;
	};
</script>

<div
	class="flex flex-col gap-1.5 rounded-lg border-l-4 border-kokum bg-surface p-4 shadow-e1"
	data-testid="action-preview"
>
	<p class="type-label text-text-2">{m.crabby_proposed()}</p>
	<p class="type-h3">{a.preview.title}</p>
	{#if a.preview.lines.length}
		<ul class="flex flex-col gap-0.5">
			{#each a.preview.lines as l, k (k)}
				{@const d = split(l)}
				<li class="flex gap-2 type-small text-text-2">
					{#if d}<span class={['w-3 shrink-0 font-semibold', d.cls]}>{d.mark}</span><span
							>{d.rest}</span
						>{:else}{l}{/if}
				</li>
			{/each}
		</ul>
	{/if}
	{#each a.preview.links ?? [] as l (l.href)}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- our routes or booking deep links -->
		<a
			href={l.href}
			class="type-small"
			target={l.href.startsWith('/') ? undefined : '_blank'}
			rel="noopener">{l.label}</a
		>
	{/each}
	{#if a.state === 'applied'}
		<p class="type-small text-text-2" role="status">{m.crabby_applied()}</p>
	{:else if a.state === 'discarded'}
		<p class="type-small text-text-2" role="status">{m.crabby_discarded()}</p>
	{:else}
		<div class="mt-2 flex flex-wrap items-center gap-3">
			<Button loading={a.state === 'busy'} onclick={() => onact(true)}>{m.crabby_apply()}</Button>
			<Button variant="ghost" onclick={() => onact(false)}>{m.crabby_discard()}</Button>
		</div>
	{/if}
</div>
