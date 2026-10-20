<script lang="ts" module>
	export type Tone = 'sakura' | 'asagi' | 'yama' | 'wakaba' | 'fuji';
</script>

<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';

	// No stock photos (CLAUDE.md §2): until a verifier photo exists, a fine line pattern over the tint
	// with "Photo coming soon" (Suna 2a/5a).
	let { tone = 'asagi', label = true }: { tone?: Tone; label?: boolean } = $props();
</script>

<div
	class="no-photo flex h-full w-full items-end p-2 text-[12px] text-text"
	style:--tone="var(--{tone})"
	style:--tone-s="var(--{tone}-s)"
>
	{#if label}<span>{m.photo_soon()}</span>{/if}
</div>
