<script lang="ts">
	import Mic from '@lucide/svelte/icons/mic';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { HostFill } from '#lib/server/ai/host.ts';
	import Crabby from './Crabby.svelte';
	import Button from './Button.svelte';

	// Host Crabby (P12 step J, product plan 10.4): say or type what changed — in Marathi, Hindi or English — and
	// Crabby fills the form below. Nothing is saved until you check the fields and press Save.
	let { type, onfill }: { type: 'stay' | 'eatery'; onfill: (f: HostFill) => void } = $props();
	let text = $state('');
	let busy = $state(false);
	let note = $state('');
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
		rec = new SR();
		rec.lang = `${getLocale()}-IN`;
		rec.interimResults = false;
		rec.onresult = (e) => (text = [...e.results].map((r) => r[0].transcript).join(' '));
		rec.onend = () => (listening = false);
		listening = true;
		rec.start();
	}

	async function fill(e: SubmitEvent) {
		e.preventDefault();
		if (text.trim().length < 3) return;
		busy = true;
		note = '';
		const r = await fetch('/api/ai/host', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type, text })
		}).catch(() => null);
		busy = false;
		if (r?.status === 429) return void (note = m.crabby_limit());
		if (!r?.ok) return void (note = m.crabby_unavailable());
		const { fill: f } = (await r.json()) as { fill: HostFill };
		if (!Object.keys(f).length) return void (note = m.host_nothing());
		onfill(f);
		note = m.host_filled();
	}
</script>

<form
	class="flex flex-col gap-3 rounded-lg bg-lagoon-50 p-4"
	onsubmit={fill}
	data-testid="host-crabby"
>
	<div class="flex items-center gap-3">
		<Crabby size={36} />
		<div class="flex flex-col">
			<h2 class="type-h3">{m.host_title()}</h2>
			<p class="type-small text-text-2">{m.host_hint()}</p>
		</div>
	</div>
	<div class="flex items-start gap-2">
		<textarea
			bind:value={text}
			rows="3"
			maxlength="1500"
			aria-label={m.host_title()}
			placeholder={m.host_placeholder()}
			class="field min-w-0 flex-1 p-3 type-body text-text"></textarea>
		{#if SR}
			<button
				type="button"
				class={[
					'flex size-11 shrink-0 items-center justify-center rounded-full',
					listening ? 'bg-lagoon text-on-lagoon' : 'bg-surface text-text-2'
				]}
				aria-label={listening ? m.crabby_mic_stop() : m.crabby_mic()}
				aria-pressed={listening}
				onclick={mic}><Mic size={22} aria-hidden="true" /></button
			>
		{/if}
	</div>
	<div class="flex flex-wrap items-center gap-3">
		<Button type="submit" variant="secondary" loading={busy}>{m.host_fill()}</Button>
		{#if note}<p class="type-small" role="status">{note}</p>{/if}
	</div>
</form>
