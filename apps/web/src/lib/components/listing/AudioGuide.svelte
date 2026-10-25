<script lang="ts">
	import Play from '@lucide/svelte/icons/play';
	import Pause from '@lucide/svelte/icons/pause';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import { m } from '#lib/paraglide/messages.js';
	import { SUPABASE_URL } from '$app/env/public';
	import Segmented from '../Segmented.svelte';

	// FRONTEND §6.13: play/pause, 15 s back, speed 0.75–1.5×, transcript toggle; language follows UI.
	// Report 2 §8: sunken card, 48 px kokum play button, a static waveform that fills as it plays.
	let { path, transcript }: { path: string; transcript: string | null } = $props();
	let audio: HTMLAudioElement;
	let paused = $state(true);
	let rate = $state(1);
	let time = $state(0);
	let duration = $state(0);
	let showText = $state(false);
	const rates = [0.75, 1, 1.25, 1.5];
	const src = $derived(`${SUPABASE_URL}/storage/v1/object/public/audio/${path}`);
	// Fixed bar heights (not the real waveform): a gentle swell, the same on every page.
	const bars = Array.from(
		{ length: 32 },
		(_, i) => 30 + Math.round(60 * Math.abs(Math.sin(i * 1.7)))
	);
	const played = $derived(duration ? time / duration : 0);
	const mmss = (s: number) =>
		`${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
</script>

<section class="flex flex-col gap-3 rounded-lg bg-surface-2 p-4" aria-label={m.audio_guide()}>
	<h2 class="type-h3">{m.audio_guide()}</h2>
	<audio
		bind:this={audio}
		{src}
		preload="none"
		bind:paused
		bind:playbackRate={rate}
		bind:currentTime={time}
		bind:duration
	></audio>
	<div class="flex items-center gap-3">
		<button
			type="button"
			class="flex size-12 shrink-0 items-center justify-center rounded-full bg-kokum text-on-kokum transition-transform duration-(--dur-press) active:scale-[.97]"
			aria-label={paused ? m.audio_play() : m.audio_pause()}
			onclick={() => (paused ? audio.play() : audio.pause())}
		>
			{#if paused}<Play size={24} aria-hidden="true" />{:else}<Pause
					size={24}
					aria-hidden="true"
				/>{/if}
		</button>
		<div class="flex h-10 min-w-0 flex-1 items-center gap-[3px]" aria-hidden="true">
			{#each bars as h, i (i)}
				<span
					class={['flex-1 rounded-full', i / bars.length < played ? 'bg-kokum' : 'bg-muted']}
					style:height="{h}%"
				></span>
			{/each}
		</div>
		<span class="shrink-0 type-small text-text-2 tabular-nums">{mmss(time)}</span>
	</div>
	<div class="flex flex-wrap items-center gap-2">
		<button
			type="button"
			class="flex size-11 items-center justify-center rounded-full text-lagoon hover:bg-surface-3"
			aria-label={m.audio_back15()}
			onclick={() => (audio.currentTime = Math.max(0, audio.currentTime - 15))}
		>
			<RotateCcw size={22} aria-hidden="true" />
		</button>
		<Segmented
			bind:value={rate}
			label={m.audio_speed()}
			options={rates.map((r) => ({ value: r, label: `${r}×` }))}
		/>
		{#if transcript}
			<button
				type="button"
				class="min-h-11 px-2 type-label text-lagoon hover:underline"
				aria-expanded={showText}
				onclick={() => (showText = !showText)}>{m.audio_transcript()}</button
			>
		{/if}
	</div>
	{#if showText && transcript}<p class="type-body whitespace-pre-line">{transcript}</p>{/if}
</section>
