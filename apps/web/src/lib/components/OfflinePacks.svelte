<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { formatNumber } from '#lib/format.ts';
	import { deletePack, downloadPack, savedPacks, type Pack, type Saved } from '#lib/packs.ts';
	import Button from './Button.svelte';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Download from '@lucide/svelte/icons/download';

	// FRONTEND §9: taluka packs — download PMTiles + listing data, show size + version + delete.
	let packs = $state<Pack[]>([]);
	let saved = $state<Saved>({});
	let busy = $state<string | null>(null);
	let error = $state(false);
	const mb = (b: number) => formatNumber(Math.round(b / 104857.6) / 10);

	onMount(async () => {
		saved = await savedPacks();
		const res = await fetch('/api/packs').catch(() => null);
		packs = res?.ok ? await res.json() : Object.values(saved);
	});

	async function toggle(p: Pack) {
		busy = p.id;
		error = false;
		try {
			if (saved[p.id]) await deletePack(p.id);
			else await downloadPack(p);
		} catch {
			error = true;
		}
		saved = await savedPacks();
		busy = null;
	}
</script>

<!-- Tideline (T-37): an inset list; a saved pack shows an ok tick. No progress ring: the download is two fetches with
     no progress events, so the button shows the Crabby walker while it runs. -->
<section class="flex flex-col gap-3" data-testid="packs">
	<h2 class="type-h2">{m.packs_title()}</h2>
	<p class="type-small text-text-2">{m.packs_hint()}</p>
	{#if !packs.length}
		<p class="type-body text-text-2">{m.packs_none()}</p>
	{:else}
		<ul class="divide-y divide-border overflow-hidden rounded-lg bg-surface shadow-e1">
			{#each packs as p (p.id)}
				{@const s = saved[p.id]}
				<li class="flex flex-wrap items-center gap-3 px-4 py-3" data-testid="pack-row">
					{#if s}<CircleCheck
							size={20}
							class="shrink-0 text-ok"
							aria-hidden="true"
						/>{:else}<Download size={20} class="shrink-0 text-text-2" aria-hidden="true" />{/if}
					<div class="min-w-0 flex-1">
						<p class="type-body-strong">{p.name}</p>
						<p class="type-small text-text-2 tabular-nums">
							{m.packs_size({ mb: mb(p.bytes) })} · {m.packs_version({
								v: p.version
							})}{#if s && s.version !== p.version}
								· <span class="text-text">{m.packs_update()}</span>{/if}
						</p>
					</div>
					<Button variant="outline" loading={busy === p.id} onclick={() => toggle(p)}>
						{s ? m.packs_delete() : m.packs_download()}
					</Button>
				</li>
			{/each}
		</ul>
	{/if}
	{#if error}<p class="type-small text-text" role="alert">{m.send_failed()}</p>{/if}
</section>
