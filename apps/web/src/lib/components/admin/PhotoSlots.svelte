<script lang="ts">
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import Trash from '@lucide/svelte/icons/trash-2';
	import Replace from '@lucide/svelte/icons/replace';
	import { processPhoto } from '#lib/field/photos.ts';
	import { LICENCES } from '#lib/photoCredit.ts';
	import type { Slot } from '#lib/admin/fields.ts';

	// Photos per form slot. Phones compress on device (WebP 480/960/1600 + LQIP) before upload. Order and slot can
	// change; file names follow the forms' convention and are set by the server.
	type Photo = {
		id: string;
		slot: string | null;
		sort_order: number;
		file_name: string | null;
		credit: string | null;
		licence: string | null;
		source_url: string | null;
		thumb: string;
	};
	let {
		type,
		id,
		slots,
		photos,
		onchange
	}: {
		type: string;
		id: string;
		slots: Slot[];
		photos: Photo[];
		onchange: (entry: unknown) => void;
	} = $props();

	let busy = $state<string | null>(null);
	let problem = $state<string | null>(null);
	let creditFor = $state<string | null>(null);
	let credit = $state({ credit: '', licence: '', source_url: '' });
	const base = $derived(`/api/admin/content/${type}/${id}/photos`);
	const inSlot = (s: string | null) =>
		photos.filter((p) => p.slot === s).sort((a, b) => a.sort_order - b.sort_order);
	const unslotted = $derived(
		photos.filter((p) => !p.slot || !slots.some((s) => s.slot === p.slot))
	);

	async function call(r: Promise<Response>) {
		problem = null;
		const res = await r.catch(() => null);
		if (!res?.ok) {
			problem = res
				? (((await res.json().catch(() => null)) as { message?: string } | null)?.message ??
					`Error ${res.status}`)
				: 'Offline?';
			return;
		}
		onchange(await res.json());
	}

	async function upload(slot: string, files: FileList | null, replace?: string) {
		if (!files?.length) return;
		busy = slot;
		try {
			for (const file of [...files]) {
				const p = await processPhoto(file);
				const f = new FormData();
				Object.entries({
					photo_id: p.id,
					slot,
					width: String(p.width),
					height: String(p.height),
					lqip: p.lqip,
					...(replace ? { replace } : {})
				}).forEach(([k, v]) => f.set(k, v));
				for (const [w, b] of Object.entries(p.blobs))
					f.set(`w${w}`, new File([b!], `${p.id}-${w}.webp`, { type: 'image/webp' }));
				await call(fetch(base, { method: 'POST', body: f }));
				if (problem) break;
			}
		} catch {
			problem = 'This photo could not be read or compressed.';
		} finally {
			busy = null;
		}
	}

	function orderWith(slot: string, list: Photo[]) {
		const rest = photos.filter((p) => p.slot && p.slot !== slot);
		return [...rest, ...list].map((p) => ({ id: p.id, slot: p.slot! }));
	}
	function move(slot: string, i: number, d: -1 | 1) {
		const list = inSlot(slot);
		const j = i + d;
		if (j < 0 || j >= list.length) return;
		[list[i], list[j]] = [list[j]!, list[i]!];
		return call(
			fetch(base, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ order: orderWith(slot, list) })
			})
		);
	}
	function toSlot(p: Photo, slot: string) {
		const order = [
			...photos.filter((x) => x.slot && x.id !== p.id).map((x) => ({ id: x.id, slot: x.slot! })),
			{ id: p.id, slot }
		];
		return call(
			fetch(base, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ order })
			})
		);
	}
	function remove(p: Photo) {
		if (!confirm(`Remove ${p.file_name ?? 'this photo'}? The file is deleted.`)) return;
		return call(
			fetch(base, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ photo: p.id })
			})
		);
	}
	function saveCredit(p: Photo) {
		creditFor = null;
		return call(
			fetch(base, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ photo: p.id, ...credit })
			})
		);
	}
	const btn =
		'flex min-h-11 min-w-11 items-center justify-center rounded-md text-text-2 hover:bg-surface-2 hover:text-text disabled:opacity-40';
</script>

{#snippet card(p: Photo, i: number, list: Photo[], slot: string)}
	<li class="flex flex-col gap-2 rounded-md border border-border p-2">
		<img
			src={p.thumb}
			alt={p.file_name ?? 'Listing photo'}
			class="aspect-4/3 w-full rounded-sm object-cover"
			loading="lazy"
		/>
		<p class="type-small break-all text-text-2">{p.file_name ?? 'Set the ID to name this file'}</p>
		{#if p.credit}<p class="type-small text-text-2">© {p.credit} · {p.licence}</p>{/if}
		<div class="flex flex-wrap items-center gap-1">
			<button
				type="button"
				class={btn}
				aria-label="Move earlier"
				disabled={!slot || i === 0}
				onclick={() => move(slot, i, -1)}><ArrowUp size={18} aria-hidden="true" /></button
			>
			<button
				type="button"
				class={btn}
				aria-label="Move later"
				disabled={!slot || i === list.length - 1}
				onclick={() => move(slot, i, 1)}><ArrowDown size={18} aria-hidden="true" /></button
			>
			<label class={[btn, 'cursor-pointer']} aria-label="Replace photo"
				><Replace size={18} aria-hidden="true" /><input
					type="file"
					accept="image/*"
					class="sr-only"
					disabled={!slot}
					onchange={(e) => upload(slot, e.currentTarget.files, p.id)}
				/></label
			>
			<button
				type="button"
				class={[btn, 'text-danger']}
				aria-label="Remove photo"
				onclick={() => remove(p)}><Trash size={18} aria-hidden="true" /></button
			>
			<select
				class="min-h-11 flex-1 rounded-md border border-border-strong bg-surface px-1 type-small"
				aria-label="Move to slot"
				value={slot}
				onchange={(e) => toSlot(p, e.currentTarget.value)}
				>{#if !slot}<option value="" disabled>Pick a slot</option
					>{/if}{#each slots as s (s.slot)}<option value={s.slot}>{s.label}</option>{/each}</select
			>
		</div>
		{#if creditFor === p.id}
			<div class="flex flex-col gap-1">
				<input
					class="min-h-11 rounded-md border border-border-strong px-2 type-small"
					placeholder="Author"
					bind:value={credit.credit}
				/>
				<select
					class="min-h-11 rounded-md border border-border-strong px-2 type-small"
					bind:value={credit.licence}
					><option value="">Our own photo</option>{#each LICENCES as l (l)}<option value={l}
							>{l}</option
						>{/each}</select
				>
				<input
					class="min-h-11 rounded-md border border-border-strong px-2 type-small"
					placeholder="https:// source page"
					bind:value={credit.source_url}
				/>
				<button
					type="button"
					class="min-h-11 rounded-md bg-surface-2 type-label"
					onclick={() => saveCredit(p)}>Save credit</button
				>
			</div>
		{:else}
			<button
				type="button"
				class="min-h-11 rounded-md type-small text-text-2 underline"
				onclick={() => {
					creditFor = p.id;
					credit = {
						credit: p.credit ?? '',
						licence: p.licence ?? '',
						source_url: p.source_url ?? ''
					};
				}}>Edit credit</button
			>
		{/if}
	</li>
{/snippet}

<section class="flex flex-col gap-4" aria-labelledby="photos-h" data-testid="photo-slots">
	<h2 id="photos-h" class="type-h2">Photos</h2>
	{#if problem}<p class="type-body text-danger" role="alert">{problem}</p>{/if}
	{#each slots as s (s.slot)}
		{@const list = inSlot(s.slot)}
		<div class="flex flex-col gap-2">
			<div class="flex flex-wrap items-center gap-2">
				<h3 class="type-h3">{s.label}</h3>
				<span class={['type-small', list.length < s.min ? 'text-caution' : 'text-text-2']}
					>{list.length} / {s.max}{#if s.min}
						· need {s.min}{/if}</span
				>
				{#if list.length < s.max}
					<label
						class="ml-auto flex min-h-11 cursor-pointer items-center rounded-md border border-border-strong px-3 type-label hover:bg-surface-2"
						>{busy === s.slot ? 'Uploading…' : 'Add photos'}<input
							type="file"
							accept="image/*"
							multiple={s.max - list.length > 1}
							class="sr-only"
							disabled={!!busy}
							onchange={(e) => upload(s.slot, e.currentTarget.files)}
						/></label
					>
				{/if}
			</div>
			{#if list.length}
				<ul class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
					{#each list as p, i (p.id)}{@render card(p, i, list, s.slot)}{/each}
				</ul>
			{/if}
		</div>
	{/each}
	{#if unslotted.length}
		<div class="flex flex-col gap-2">
			<h3 class="type-h3">Not in a slot yet (older uploads)</h3>
			<ul class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
				{#each unslotted as p, i (p.id)}{@render card(p, i, unslotted, p.slot ?? '')}{/each}
			</ul>
		</div>
	{/if}
</section>
