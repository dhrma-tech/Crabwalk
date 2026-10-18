<script lang="ts">
	import Mic from '@lucide/svelte/icons/mic';
	import Send from '@lucide/svelte/icons/send';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { ask, crabby, decide, type Action } from '#lib/crabby.svelte.ts';
	import Crabby from '../Crabby.svelte';
	import Button from '../Button.svelte';
	import EmergencyCard from '../EmergencyCard.svelte';

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
		class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
		aria-live="polite"
	>
		{#if !crabby.turns.length}
			<div class="flex flex-col items-center gap-2 py-8 text-center">
				<Crabby size={72} />
				<p class="type-body text-text-2">{m.crabby_hello()}</p>
			</div>
		{/if}
		{#each crabby.turns as t, i (i)}
			{#if t.role === 'user'}
				<p
					class="max-w-[85%] self-end rounded-card bg-sand-50 px-4 py-2 type-body text-sand-900"
					data-testid="bubble-user"
				>
					{t.content}
				</p>
			{:else}
				<div class="flex max-w-[92%] items-start gap-2 self-start">
					<Crabby size={32} />
					<div
						class="flex flex-col gap-2 rounded-card border border-border bg-surface px-4 py-2"
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
							<ul class="flex flex-col gap-1" data-testid="crabby-alternatives">
								{#each t.alternatives as alt (alt.slug)}
									<li>
										<a href={resolve('/place/[slug]', { slug: alt.slug })} class="type-body"
											>{alt.name}</a
										>
									</li>
								{/each}
							</ul>
						{/if}
						{#each t.actions ?? [] as a (a.id)}
							<div
								class="flex flex-col gap-2 rounded-card border border-border bg-raised p-3"
								data-testid="action-preview"
							>
								<p class="type-h3">{a.preview.title}</p>
								{#each a.preview.lines as l, k (k)}<p class="type-small">{l}</p>{/each}
								{#each a.preview.links ?? [] as l (l.href)}
									<!-- eslint-disable svelte/no-navigation-without-resolve -- our routes or booking deep links -->
									<a
										href={l.href}
										class="type-small"
										target={l.href.startsWith('/') ? undefined : '_blank'}
										rel="noopener">{l.label}</a
									>
								{/each}
								{#if a.state === 'applied'}
									<p class="type-small text-text-2" role="status">{m.crabby_applied()}</p>
								{:else if a.state === 'discarded'}
									<p class="type-small text-text-2" role="status">{m.crabby_discarded()}</p>
								{:else}
									<div class="flex gap-2">
										<Button loading={a.state === 'busy'} onclick={() => act(a, true)}
											>{m.crabby_apply()}</Button
										>
										<Button variant="ghost" onclick={() => act(a, false)}
											>{m.crabby_discard()}</Button
										>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/each}
		{#if crabby.busy}
			<div class="flex items-center gap-2 self-start" role="status">
				<Crabby size={32} walking /><span class="type-small text-text-2">{m.crabby_thinking()}</span
				>
			</div>
		{/if}
	</div>

	{#if crabby.signin}
		<div
			class="flex flex-col items-center gap-2 border-t border-border p-4 text-center"
			data-testid="crabby-signin"
		>
			<p class="type-body">{m.crabby_signin()}</p>
			<Button href={resolve('/login')}>{m.sign_in()}</Button>
		</div>
	{:else}
		{#if chips.length && !crabby.turns.length}
			<div class="flex gap-2 overflow-x-auto px-4 pb-2">
				{#each chips as c (c)}
					<button
						type="button"
						class="min-h-11 shrink-0 rounded-chip border border-border bg-surface px-4 type-small"
						onclick={() => ((text = c), send())}>{c}</button
					>
				{/each}
			</div>
		{/if}
		<form onsubmit={send} class="flex items-end gap-2 border-t border-border p-3">
			{#if SR}
				<button
					type="button"
					class={[
						'flex size-12 shrink-0 items-center justify-center rounded-full border',
						listening
							? 'animate-pulse border-sea-500 bg-sea-500 text-white motion-reduce:animate-none'
							: 'border-border text-text'
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
				class="min-h-12 flex-1 resize-none rounded-input border border-border bg-surface px-4 py-3 type-body text-text"
				onkeydown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						send();
					}
				}}></textarea>
			<button
				type="submit"
				disabled={!text.trim() || crabby.busy}
				class="flex size-12 shrink-0 items-center justify-center rounded-full bg-cta text-on-cta disabled:opacity-50"
				aria-label={m.crabby_send()}
			>
				<Send size={20} aria-hidden="true" />
			</button>
		</form>
		<p class="flex flex-wrap gap-x-1.5 px-4 pb-3 type-small text-text-2">
			{#if crabby.remaining != null}<span>{m.crabby_remaining({ n: crabby.remaining })}</span><span
					aria-hidden="true">·</span
				>{/if}<a href={resolve('/privacy')}>{m.crabby_privacy()}</a>
		</p>
	{/if}
</div>

{#if crabby.emergency}
	<EmergencyCard onclose={() => (crabby.emergency = false)} />
{/if}
