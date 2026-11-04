<script lang="ts">
	import Mic from '@lucide/svelte/icons/mic';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';

	// A text box the user can also speak into (browser speech recognition, in the app's language).
	let {
		value = $bindable(''),
		label,
		rows = 2,
		maxlength = 1500
	}: { value?: string; label: string; rows?: number; maxlength?: number } = $props();
	let listening = $state(false);

	type Rec = {
		lang: string;
		interimResults: boolean;
		onresult: (e: { results: { 0: { transcript: string } }[] }) => void;
		onend: () => void;
		start: () => void;
		stop: () => void;
	};
	const SR =
		typeof window !== 'undefined'
			? ((window as unknown as { SpeechRecognition?: new () => Rec }).SpeechRecognition ??
				(window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition)
			: undefined;
	let rec: Rec | null = null;
	function mic() {
		if (!SR) return;
		if (listening) return rec?.stop();
		const before = value.trim();
		rec = new SR();
		rec.lang = `${getLocale()}-IN`;
		rec.interimResults = false;
		rec.onresult = (e) =>
			(value = [before, ...[...e.results].map((r) => r[0].transcript)].filter(Boolean).join(' '));
		rec.onend = () => (listening = false);
		listening = true;
		rec.start();
	}
</script>

<div class="flex items-start gap-2">
	<textarea
		bind:value
		{rows}
		{maxlength}
		aria-label={label}
		class="field min-w-0 flex-1 p-3 type-body text-text"></textarea>
	{#if SR}
		<button
			type="button"
			class={[
				'flex size-11 shrink-0 items-center justify-center rounded-full',
				listening ? 'bg-lagoon text-on-lagoon' : 'bg-surface-2 text-text-2'
			]}
			aria-label={listening ? m.crabby_mic_stop() : m.crabby_mic()}
			aria-pressed={listening}
			onclick={mic}><Mic size={22} aria-hidden="true" /></button
		>
	{/if}
</div>
