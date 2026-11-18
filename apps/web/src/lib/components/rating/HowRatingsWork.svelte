<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import CircleHelp from '@lucide/svelte/icons/circle-help';
	import { m } from '#lib/paraglide/messages.js';
	import IconButton from '../IconButton.svelte';

	// Hardening T1-05 (UX-03): a link under the gauge opens a sheet with the four rules behind the numbers.
	let dialog: HTMLDialogElement | undefined = $state();
	const id = $props.id();
</script>

<button
	type="button"
	class="inline-flex min-h-11 w-fit items-center gap-1.5 type-label text-link underline-offset-4 hover:underline"
	aria-haspopup="dialog"
	onclick={() => dialog?.showModal()}
	><CircleHelp size={16} aria-hidden="true" />{m.ratings_how()}</button
>

<dialog
	bind:this={dialog}
	aria-labelledby={id}
	class="mx-auto mt-auto mb-0 w-full max-w-none rounded-t-xl bg-surface p-5 pb-[calc(--spacing(5)+env(safe-area-inset-bottom))] text-text shadow-e3 backdrop:bg-(--scrim) lg:m-auto lg:max-w-105 lg:rounded-xl lg:pb-5"
	data-testid="how-ratings"
>
	<div class="flex items-center justify-between gap-2">
		<h2 {id} class="type-h2">{m.ratings_how()}</h2>
		<IconButton label={m.close()} onclick={() => dialog?.close()}
			><X size={20} aria-hidden="true" /></IconButton
		>
	</div>
	<ul class="mt-3 flex list-disc flex-col gap-2 pl-5 type-body">
		<li>{m.ratings_how_words()}</li>
		<li>{m.ratings_how_groups()}</li>
		<li>{m.ratings_how_verified()}</li>
		<li>{m.ratings_how_moderation()}</li>
	</ul>
</dialog>
