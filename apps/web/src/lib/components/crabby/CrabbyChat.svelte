<script lang="ts">
	import Mic from '@lucide/svelte/icons/mic';
	import Send from '@lucide/svelte/icons/send';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { ask, crabby, decide, type Action } from '#lib/crabby.svelte.ts';
	import Crabby from '../Crabby.svelte';
	import Button from '../Button.svelte';
	import EmergencyCard from '../EmergencyCard.svelte';
	import ActionPreviewCard from './ActionPreviewCard.svelte';
	import { page } from '$app/state';
	import { loginHref } from '#lib/login.ts';

	// FRONTEND §6.7: chat bubbles, ActionPreviewCard (Apply / Discard), mic (Web Speech API), honest
	// "I don't know" + verified alternatives, daily-limit state, login wall. Emergency → EmergencyCard.
	let { chips = [] }: { chips?: string[] } = $props();
	let text = $state('');
	let listening = $state(false);
	let list: HTMLElement | undefined = $state();

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
			? ((
					window as unknown as {
						SpeechRecognition?: new () => Rec;
						webkitSpeechRecognition?: new () => Rec;
					}
				).SpeechRecognition ??
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

	async function send(e?: SubmitEvent) {
		e?.preventDefault();
		const t = text;
		text = '';
		await ask(t);
		list?.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
	}

	async function act(a: Action, apply: boolean) {
		const href = await decide(a, apply);
		if (!href) return;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- href is one of our routes built server-side
		if (href.startsWith('/')) await goto(href);
		else window.open(href, '_blank', 'noopener');
	}
</script>

<div class="flex h-full min-h-0 flex-col" data-testid="crabby-chat">
	<div
		bind:this={list}
		class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4"
		aria-live="polite"
	>
		{#if !crabby.turns.length}
			<div class="my-auto flex flex-col items-center gap-3 px-2 py-6 text-center">
				<Crabby size={64} />
				<p class="max-w-80 type-body text-text-2">{m.crabby_hello()}</p>
			</div>
		{/if}
		{#each crabby.turns as t, i (i)}
			{#if t.role === 'user'}
				<p
					class="max-w-[85%] self-end rounded-lg rounded-br-sm bg-kokum-50 px-3.5 py-2.5 type-body text-kokum-ink"
					data-testid="bubble-user"
				>
					{t.content}
				</p>
			{:else}
				<div class="flex max-w-[92%] items-start gap-2.5 self-start">
					<Crabby size={30} />
					<!-- Report 2 §9.11: Crabby bubbles surface + e1; the daily limit is a friendly lagoon card. -->
					<div
						class={[
							'flex min-w-0 flex-1 flex-col gap-2.5 rounded-lg rounded-tl-sm px-3.5 py-2.5',
							t.kind === 'limit' ? 'bg-lagoon-50' : 'bg-surface shadow-e1'
						]}
						data-testid="bubble-crabby"
					>
						{#if t.kind === 'limit'}
							<p class="type-body" data-testid="crabby-limit">{m.crabby_limit()}</p>
						{:else if t.kind === 'refused'}
							<p class="type-body">{m.crabby_refused()}</p>
						{:else if t.kind === 'unavailable'}
							<p class="type-body">{m.crabby_unavailable()}</p>
						{:else}
							<p class="type-body whitespace-pre-line">{t.content}</p>
						{/if}
						{#if t.alternatives?.length}
							<p class="type-small text-text-2">{m.crabby_alternatives()}</p>
							<ul class="flex flex-col gap-1.5" data-testid="crabby-alternatives">
								{#each t.alternatives as alt (alt.slug)}
									<li>
										<a
											href={resolve('/place/[slug]', { slug: alt.slug })}
											class="flex min-h-11 items-center gap-2.5 rounded-md bg-surface-2 px-3 py-2 type-body-strong text-text no-underline hover:bg-surface-3"
											><MapPin size={18} class="shrink-0 text-kokum" aria-hidden="true" /><span
												class="min-w-0 flex-1">{alt.name}</span
											><ChevronRight size={18} class="shrink-0 text-text-2" aria-hidden="true" /></a
										>
									</li>
								{/each}
							</ul>
						{/if}
						{#each t.actions ?? [] as a (a.id)}
							<ActionPreviewCard action={a} onact={(apply) => act(a, apply)} />
						{/each}
					</div>
				</div>
			{/if}
		{/each}
		{#if crabby.busy}
			<div class="flex items-center gap-2 self-start" role="status">
				<Crabby size={30} walking /><span class="type-small text-text-2">{m.crabby_thinking()}</span
				>
			</div>
		{/if}
	</div>

	{#if crabby.signin}
		<div
			class="mx-4 mb-4 flex flex-col items-center gap-3 rounded-xl bg-lagoon-50 p-5 text-center"
			data-testid="crabby-signin"
		>
			<Crabby size={48} />
			<p class="type-body-strong text-text">{m.crabby_signin()}</p>
			<div class="w-full [&>*]:w-full">
				<Button href={loginHref(page.url)}>{m.sign_in()}</Button>
			</div>
		</div>
	{:else}
		{#if chips.length && !crabby.turns.length}
			<div class="flex flex-wrap gap-1.5 px-6 pb-2">
				{#each chips as c (c)}
					<button
						type="button"
						class="min-h-11 rounded-full bg-surface-2 px-4 py-2 text-left type-label text-text hover:bg-surface-3"
						onclick={() => ((text = c), send())}>{c}</button
					>
				{/each}
			</div>
		{/if}
		<form onsubmit={send} class="field mx-6 flex items-end gap-1 rounded-xl p-0.5">
			{#if SR}
				<button
					type="button"
					class={[
						'flex size-11 shrink-0 items-center justify-center rounded-full',
						listening
							? 'animate-pulse bg-lagoon text-on-lagoon motion-reduce:animate-none'
							: 'text-text-2 hover:text-text'
					]}
					aria-label={listening ? m.crabby_mic_stop() : m.crabby_mic()}
					aria-pressed={listening}
					onclick={mic}><Mic size={22} aria-hidden="true" /></button
				>
			{/if}
			<label class="sr-only" for="crabby-input">{m.crabby_placeholder()}</label>
			<textarea
				id="crabby-input"
				bind:value={text}
				rows="1"
				maxlength="1000"
				placeholder={m.crabby_placeholder()}
				class="min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 type-body text-text placeholder:text-muted"
				onkeydown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						send();
					}
				}}></textarea>
			<button
				type="submit"
				disabled={!text.trim() || crabby.busy}
				class="flex size-11 shrink-0 items-center justify-center rounded-full bg-kokum text-on-kokum transition-colors duration-(--dur-state) disabled:bg-transparent disabled:text-muted"
				aria-label={m.crabby_send()}
			>
				<Send size={20} aria-hidden="true" />
			</button>
		</form>
		{#if crabby.remaining != null}
			<p class="flex min-h-11 items-center px-6 pt-1 pb-2 type-small text-text-2">
				<span class="tabular-nums">{m.crabby_remaining({ n: crabby.remaining })}</span>
			</p>
		{/if}
	{/if}
</div>

{#if crabby.emergency}
	<EmergencyCard onclose={() => (crabby.emergency = false)} />
{/if}
