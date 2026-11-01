<script lang="ts">
	import Camera from '@lucide/svelte/icons/camera';
	import { m } from '#lib/paraglide/messages.js';
	import Crabby from '../Crabby.svelte';
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

<!-- Tideline (T-40): an outline button (the file input inside is focusable, so focus shows on the label). -->
<div class="flex flex-col gap-3">
	<label
		class="inline-flex min-h-12 w-fit cursor-pointer items-center gap-2 rounded-md border-[1.5px] border-border-strong px-5 type-body-strong text-text transition-colors duration-(--dur-state) hover:bg-surface-2 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus)"
		aria-busy={busy}
	>
		{#if busy}<Crabby size={20} walking tone="kokum" />{:else}<Camera
				size={20}
				aria-hidden="true"
			/>{/if}{m.field_photos()}
		<input type="file" accept="image/*" multiple class="sr-only" onchange={pick} disabled={busy} />
	</label>
	{#if failed}<p class="rounded-md bg-danger-50 p-3 type-small text-text" role="alert">
			{m.send_failed()}
		</p>{/if}
	{#if done.length}<div class="flex flex-wrap gap-2">
			{#each done as src, i (i)}<img {src} alt="" class="size-20 rounded-md object-cover" />{/each}
		</div>{/if}
</div>
