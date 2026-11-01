<script lang="ts">
	import { resolve } from '$app/paths';
	import BedDouble from '@lucide/svelte/icons/bed-double';
	import Utensils from '@lucide/svelte/icons/utensils';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Clock from '@lucide/svelte/icons/clock';
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import InsetList from '#lib/components/InsetList.svelte';
	import type { PageProps } from './$types';

	// Tideline tool variant (Report 2 §9.15, T-40): denser, inset rows, no imagery; no "Internal tool" banner
	// here (user: owners are not staff).
	let { data }: PageProps = $props();
</script>

<Page title={m.owner_title()} back>
	<div class="mx-auto flex max-w-170 flex-col gap-4">
		{#if data.pending}<p class="flex gap-2.5 rounded-md bg-caution-50 p-3 type-small text-text">
				<Clock size={18} class="mt-0.5 shrink-0" aria-hidden="true" />{m.claim_pending()}
			</p>{/if}
		{#if data.listings.length}
			<InsetList>
				<ul>
					{#each data.listings as l (l.id)}
						<li class="border-b border-border last:border-0">
							<a
								href={resolve('/owner/[type]/[id]', { type: l.type, id: l.id })}
								class="row-link flex min-h-14 items-center gap-3 px-4 py-2.5 text-text no-underline"
								>{#if l.type === 'stay'}<BedDouble
										size={20}
										class="shrink-0 text-lagoon"
										aria-hidden="true"
									/>{:else}<Utensils
										size={20}
										class="shrink-0 text-alphonso-ink"
										aria-hidden="true"
									/>{/if}<span class="min-w-0 flex-1 type-body-strong">{l.name}</span><span
									class="type-small text-text-2">{m.owner_edit()}</span
								><ChevronRight size={18} class="shrink-0 text-text-2" aria-hidden="true" /></a
							>
						</li>
					{/each}
				</ul>
			</InsetList>
		{:else}
			<p class="type-body text-text-2">{m.owner_none()}</p>
		{/if}
		<p class="type-small text-text-2">{m.owner_ratings_readonly()}</p>
	</div>
</Page>
