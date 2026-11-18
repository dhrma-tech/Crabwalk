<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import EmptyState from '../EmptyState.svelte';
	import Button from '../Button.svelte';
	import { isSet, valueLabel, without, type Field } from './ListControls.svelte';

	// Hardening T1-10 (UX-02): an empty filtered list names its filters. Each chip links to the same list without
	// that one filter; "Clear all" drops them all. With no filter set there is nothing to undo.
	let { fields, clear }: { fields: Field[]; clear: string } = $props();
	const active = $derived(fields.filter(isSet));
</script>

<EmptyState title={m.soon_title()} body={m.no_results()} art="net">
	{#snippet action()}
		{#if active.length}
			<div class="flex flex-col items-center gap-3" data-testid="empty-filters">
				<ul class="flex flex-wrap justify-center gap-2">
					{#each active as f (f.name)}
						<li>
							<!-- eslint-disable svelte/no-navigation-without-resolve -- same page, query only -->
							<a
								href={without(page.url, f.name)}
								class="inline-flex min-h-11 items-center no-underline"
								aria-label={`${f.label}: ${valueLabel(f)}. ${m.filter_clear({ filter: f.label })}`}
							>
								<span
									class="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-text px-3.5 py-1 type-label text-bg"
								>
									{f.label}: {valueLabel(f)}<X size={16} aria-hidden="true" />
								</span>
							</a>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						</li>
					{/each}
				</ul>
				<Button href={clear} variant="secondary">{m.filters_clear_all()}</Button>
			</div>
		{/if}
	{/snippet}
</EmptyState>
