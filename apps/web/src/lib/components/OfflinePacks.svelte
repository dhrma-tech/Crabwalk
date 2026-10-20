<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { formatNumber } from '#lib/format.ts';
	import { deletePack, downloadPack, savedPacks, type Pack, type Saved } from '#lib/packs.ts';
	import Button from './Button.svelte';

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

<section class="flex flex-col gap-3 border-t border-text pt-3" data-testid="packs">
	<h2 class="type-h2">{m.packs_title()}</h2>
	<p class="type-small text-text-2">{m.packs_hint()}</p>
	{#if !packs.length}
		<p class="type-body text-text-2">{m.packs_none()}</p>
	{/if}
	<ul class="flex flex-col divide-y divide-border">
		{#each packs as p (p.id)}
			{@const s = saved[p.id]}
			<li class="flex flex-wrap items-center justify-between gap-2 py-2" data-testid="pack-row">
				<div>
					<p class="type-body">{p.name}</p>
					<p class="type-small text-text-2">
						{m.packs_size({ mb: mb(p.bytes) })} · {m.packs_version({
							v: p.version
						})}{#if s && s.version !== p.version}
							· {m.packs_update()}{/if}
					</p>
				</div>
				<Button
					variant={s ? 'ghost' : 'secondary'}
					loading={busy === p.id}
					onclick={() => toggle(p)}
				>
					{s ? m.packs_delete() : m.packs_download()}
				</Button>
			</li>
		{/each}
	</ul>
	{#if error}<p class="type-small" role="alert">{m.send_failed()}</p>{/if}
</section>
