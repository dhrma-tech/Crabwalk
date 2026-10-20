<script lang="ts">
	import Play from '@lucide/svelte/icons/play';
	import Pause from '@lucide/svelte/icons/pause';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import { m } from '#lib/paraglide/messages.js';
	import { SUPABASE_URL } from '$app/env/public';

	// FRONTEND §6.13: play/pause, 15 s back, speed 0.75–1.5×, transcript toggle; language follows UI.
	let { path, transcript }: { path: string; transcript: string | null } = $props();
	let audio: HTMLAudioElement;
	let paused = $state(true);
	let rate = $state(1);
	let showText = $state(false);
	const rates = [0.75, 1, 1.25, 1.5];
	const src = $derived(`${SUPABASE_URL}/storage/v1/object/public/audio/${path}`);
</script>

<section class="flex flex-col gap-3 border border-text px-3 py-3" aria-label={m.audio_guide()}>
	<h2 class="type-h3">{m.audio_guide()}</h2>
	<audio bind:this={audio} {src} preload="none" bind:paused bind:playbackRate={rate}></audio>
	<div class="flex flex-wrap items-center gap-2">
		<button
			type="button"
			class="flex size-11 items-center justify-center bg-cta text-on-cta"
			aria-label={paused ? m.audio_play() : m.audio_pause()}
			onclick={() => (paused ? audio.play() : audio.pause())}
		>
			{#if paused}<Play size={24} aria-hidden="true" />{:else}<Pause
					size={24}
					aria-hidden="true"
				/>{/if}
		</button>
		<button
			type="button"
			class="flex size-11 items-center justify-center text-link"
			aria-label={m.audio_back15()}
			onclick={() => (audio.currentTime = Math.max(0, audio.currentTime - 15))}
		>
			<RotateCcw size={22} aria-hidden="true" />
		</button>
		<div class="flex border border-text" role="group" aria-label={m.audio_speed()}>
			{#each rates as r (r)}
				<button
					type="button"
					aria-pressed={rate === r}
					class={['min-h-11 px-3 type-small', rate === r ? 'bg-text text-bg' : 'text-text-2']}
					onclick={() => (rate = r)}>{r}×</button
				>
			{/each}
		</div>
		{#if transcript}
			<button
				type="button"
				class="min-h-11 px-2 type-small text-link"
				aria-expanded={showText}
				onclick={() => (showText = !showText)}>{m.audio_transcript()}</button
			>
		{/if}
	</div>
	{#if showText && transcript}<p class="type-body whitespace-pre-line">{transcript}</p>{/if}
</section>
