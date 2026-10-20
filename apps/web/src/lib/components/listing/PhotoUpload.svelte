<script lang="ts">
	import Camera from '@lucide/svelte/icons/camera';
	import { m } from '#lib/paraglide/messages.js';
	import { processPhoto, uploadPhoto } from '#lib/field/photos.ts';

	// Online photo upload for owners (same WebP pipeline as the field form).
	let { type, id }: { type: 'stay' | 'eatery'; id: string } = $props();
	let busy = $state(false);
	let done = $state<string[]>([]);
	let failed = $state(false);

	async function pick(e: Event) {
		busy = true;
		failed = false;
		for (const file of (e.target as HTMLInputElement).files ?? []) {
			try {
				const p = await processPhoto(file);
				await uploadPhoto(p, { type, id }, false);
				done.push(URL.createObjectURL(p.blobs[480]!));
			} catch {
				failed = true;
			}
		}
		busy = false;
		(e.target as HTMLInputElement).value = '';
	}
</script>

<div class="flex flex-col gap-2">
	<label
		class="flex min-h-11 w-fit cursor-pointer items-center gap-2 border border-text px-4 type-small"
		aria-busy={busy}
	>
		<Camera size={20} aria-hidden="true" />{m.field_photos()}
		<input type="file" accept="image/*" multiple class="sr-only" onchange={pick} disabled={busy} />
	</label>
	{#if failed}<p class="type-small" role="alert">{m.send_failed()}</p>{/if}
	{#if done.length}<div class="flex flex-wrap gap-2">
			{#each done as src, i (i)}<img {src} alt="" class="size-20 object-cover" />{/each}
		</div>{/if}
</div>
