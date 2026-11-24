<script lang="ts">
	import Mic from '@lucide/svelte/icons/mic';
	import Camera from '@lucide/svelte/icons/camera';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import {
		answerCard,
		ask,
		crabby,
		decide,
		loadTeamQuestions,
		rate,
		sendToTeam,
		snap,
		type Action
	} from '#lib/crabby.svelte.ts';
	import ThumbsUp from '@lucide/svelte/icons/thumbs-up';
	import ThumbsDown from '@lucide/svelte/icons/thumbs-down';
	import IconButton from '../IconButton.svelte';
	import { onMount } from 'svelte';
	import Crabby from '../CrabbyMark.svelte';
	import Illustration from '../Illustration.svelte';
	import Button from '../Button.svelte';
	import EmergencyCard from '../EmergencyCard.svelte';
	import ActionPreviewCard from './ActionPreviewCard.svelte';
	import QuestionCard from './QuestionCard.svelte';
	import RealityCheck from './RealityCheck.svelte';
	import { page } from '$app/state';
	import { signInPath } from '#lib/login.ts';

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

	// Questions to our team (10.1): Pending ones and fresh answers show at the top of the chat.
	onMount(() => void loadTeamQuestions());

	async function act(a: Action, apply: boolean) {
		const href = await decide(a, apply);
		if (apply && a.type === 'ask_team') await loadTeamQuestions();
		if (!href) return;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- href is one of our routes built server-side
		if (href.startsWith('/')) await goto(href);
		else window.open(href, '_blank', 'noopener');
	}
</script>

<div class="flex h-full min-h-0 flex-col" data-testid="crabby-chat">
	<div
		bind:this={list}
		class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
		aria-live="polite"
	>
		{#if crabby.team.length}
			<section class="flex flex-col gap-2 rounded-lg bg-surface-2 p-3" data-testid="team-questions">
				<h2 class="type-label text-text-2">{m.team_yours()}</h2>
				<ul class="flex flex-col gap-2">
					{#each crabby.team as q (q.id)}
						<li
							class="flex flex-col gap-1 rounded-md bg-surface p-3 shadow-e1"
							data-testid="team-question"
						>
							<p class="type-small text-text-2">“{q.question}”</p>
							{#if q.status === 'answered'}
								<p class="type-body">{q.answer}</p>
								<p class="type-label text-lagoon-ink">
									{q.fresh ? `${m.team_new()} · ` : ''}{m.team_answered_on({
										date: q.answered_on ?? ''
									})}
								</p>
							{:else}
								<p class="type-label text-text-2">
									<span class="rounded-full bg-alphonso-50 px-2 py-0.5 text-text"
										>{m.pending()}</span
									>
									{m.team_wait()}
								</p>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/if}
		{#if !crabby.turns.length}
			<div class="my-auto flex flex-col items-center gap-3 px-2 py-6 text-center">
				<Crabby size={64} />
				<p class="max-w-80 type-body text-text-2">{m.crabby_hello()}</p>
			</div>
		{/if}
		{#each crabby.turns as t, i (i)}
			{#if t.role === 'user'}
				<p
					class="crabby-msg max-w-[85%] origin-bottom-right self-end rounded-[22px] rounded-br-md bg-surface-2 px-4 py-2.5 type-body text-text"
					data-testid="bubble-user"
				>
					{t.content}
				</p>
			{:else}
				<div class="crabby-msg flex max-w-[94%] origin-top-left items-start gap-2.5 self-start">
					<span
						class="flex size-9 shrink-0 items-center justify-center rounded-full bg-kokum-50 ring-1 ring-kokum-100"
						><Crabby size={24} /></span
					>
					<!-- Report 2 §9.11: Crabby bubbles surface + e1; the daily limit is a friendly lagoon card. -->
					<div
						class={[
							'flex min-w-0 flex-1 flex-col gap-2.5 rounded-[22px] rounded-tl-md px-3.5 py-2.5',
							t.kind === 'limit' ? 'bg-lagoon-50' : t.kind ? 'bg-surface-2' : 'pt-1.5'
						]}
						data-testid="bubble-crabby"
					>
						{#if t.kind === 'limit'}
							<Illustration name="tide" class="w-28" />
							<p class="type-body" data-testid="crabby-limit">{m.crabby_limit()}</p>
						{:else if t.kind === 'refused'}
							<p class="type-body">{m.crabby_refused()}</p>
						{:else if t.kind === 'unavailable'}
							<Illustration name="lamp" class="w-28" />
							<p class="type-body">{m.crabby_unavailable()}</p>
						{:else}
							<p class="type-body whitespace-pre-line">
								{t.content}{#if crabby.busy && i === crabby.turns.length - 1}<span
										class="crabby-caret ml-0.5 inline-block h-[1.1em] w-0.5 translate-y-[0.2em] rounded-full bg-kokum"
										aria-hidden="true"
									></span>{/if}
							</p>
						{/if}
						{#if t.cites?.length}
							<!-- T2-03: the listings the reply names, checked against this turn's results. -->
							<ul
								class="flex flex-wrap gap-2"
								aria-label={m.crabby_cites()}
								data-testid="crabby-cites"
							>
								{#each t.cites as c (c.slug)}
									<li>
										<a
											href={c.kind === 'stay'
												? resolve('/stays/[slug]', { slug: c.slug })
												: c.kind === 'eatery'
													? resolve('/food/[slug]', { slug: c.slug })
													: c.kind === 'dish'
														? resolve('/taste-konkan/[dish]', { dish: c.slug })
														: resolve('/place/[slug]', { slug: c.slug })}
											class="inline-flex min-h-11 items-center rounded-full bg-surface-2 px-3.5 type-small text-text no-underline hover:bg-surface-3"
											>{c.name}</a
										>
									</li>
								{/each}
							</ul>
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
						{#if t.turn}
							<!-- T2-05: thumbs on the answer; a 👎 offers (never sends by itself) to tell our team. -->
							<div class="-mb-1 flex items-center gap-1 text-text-2" data-testid="crabby-thumbs">
								<IconButton
									label={m.crabby_helpful()}
									aria-pressed={t.thumbs === 1}
									disabled={!!t.thumbs}
									onclick={() => rate(t, 1)}><ThumbsUp size={18} aria-hidden="true" /></IconButton
								>
								<IconButton
									label={m.crabby_not_helpful()}
									aria-pressed={t.thumbs === -1}
									disabled={!!t.thumbs}
									onclick={() => rate(t, -1)}
									><ThumbsDown size={18} aria-hidden="true" /></IconButton
								>
								{#if t.thumbs === 1 || t.offer === 'sent' || t.offer === 'closed'}
									<span class="type-small" role="status">{m.crabby_feedback_thanks()}</span>
								{/if}
							</div>
							{#if t.offer === 'ask'}
								<div class="flex flex-col gap-2 rounded-md bg-surface-2 p-3">
									<p class="type-small">{m.crabby_send_team_ask()}</p>
									<div class="flex gap-2">
										<Button onclick={() => sendToTeam(t, true)}>{m.crabby_send_team_yes()}</Button>
										<Button variant="ghost" onclick={() => sendToTeam(t, false)}
											>{m.crabby_send_team_no()}</Button
										>
									</div>
								</div>
							{/if}
						{/if}
						{#if t.questions}
							<QuestionCard
								questions={t.questions}
								answered={t.answered}
								onanswer={(answer) => answerCard(t, answer)}
							/>
						{/if}
						{#if t.snap?.kind === 'match'}
							<!-- eslint-disable svelte/no-navigation-without-resolve -- place / dish route from our server -->
							<div class="flex flex-col gap-1" data-testid="snap-match">
								<p class="type-label text-text-2">{m.snap_found()}</p>
								<a href={t.snap.href} class="type-h3">{t.snap.name}</a>
								{#if t.snap.story}<p class="type-body">{t.snap.story}</p>{/if}
							</div>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{:else if t.snap?.kind === 'unsure'}
							<div class="flex flex-col gap-2" data-testid="snap-unsure">
								<p class="type-body">{m.snap_unsure()}</p>
								<div>
									<Button
										variant="secondary"
										onclick={() =>
											t.snap?.kind === 'unsure' &&
											ask(m.snap_ask_team({ what: t.snap.description }))}>{m.snap_team()}</Button
									>
								</div>
							</div>
						{:else if t.snap?.kind === 'consent'}
							<p class="type-body" data-testid="snap-consent">
								{m.snap_consent()}
								<a href={resolve('/me/crabby')}>{m.crabby_me_title()}</a>
							</p>
						{/if}
						{#if t.reel?.kind === 'found'}
							<div class="flex flex-col gap-2" data-testid="reel-found">
								<p class="type-small text-text-2">{m.reel_found()}</p>
								{#each t.reel.places as p (p.slug)}<RealityCheck place={p} />{/each}
								{#if !t.reel.action}
									<a href={resolve('/plan/new')} class="type-label">{m.reel_no_trip()}</a>
								{/if}
							</div>
						{:else if t.reel?.kind === 'none'}
							<div class="flex flex-col gap-2" data-testid="reel-none">
								<p class="type-body">{m.reel_none()}</p>
								<div>
									<Button
										variant="secondary"
										onclick={() =>
											t.reel?.kind === 'none' && ask(m.reel_ask_team({ what: t.reel.what }))}
										>{m.snap_team()}</Button
									>
								</div>
							</div>
						{:else if t.reel?.kind === 'need_caption'}
							<p class="type-body" data-testid="reel-caption">{m.reel_need_caption()}</p>
						{:else if t.reel?.kind === 'consent'}
							<p class="type-body" data-testid="snap-consent">
								{m.snap_consent()}
								<a href={resolve('/me/crabby')}>{m.crabby_me_title()}</a>
							</p>
						{/if}
						{#each t.actions ?? [] as a (a.id)}
							<ActionPreviewCard action={a} onact={(apply) => act(a, apply)} />
						{/each}
					</div>
				</div>
			{/if}
		{/each}
		{#if crabby.busy}
			<div class="crabby-msg flex items-center gap-2.5 self-start" role="status">
				<span
					class="flex size-9 shrink-0 items-center justify-center rounded-full bg-kokum-50 ring-1 ring-kokum-100"
					><Crabby size={24} walking /></span
				>
				<span class="crabby-shimmer type-small"
					>{crabby.status === 'tools'
						? m.crabby_status_tools()
						: crabby.status === 'writing'
							? m.crabby_status_writing()
							: m.crabby_thinking()}</span
				>
				<span class="flex gap-1" aria-hidden="true">
					{#each [0, 1, 2] as d (d)}
						<span
							class="crabby-dot size-1.5 rounded-full bg-kokum"
							style:animation-delay="{d * 0.15}s"
						></span>
					{/each}
				</span>
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
				<!-- A link, not SignInButton: this panel is in the app shell (size budget). Temp gate: /guest and back. -->
				<Button href={signInPath(page.url, !!page.data.gate?.on)}
					>{page.data.gate?.on ? m.guest_continue() : m.sign_in()}</Button
				>
			</div>
		</div>
	{:else}
		{#if chips.length && !crabby.turns.length}
			<div class="flex flex-wrap gap-1.5 px-4 pb-2">
				{#each chips as c, n (c)}
					<button
						type="button"
						style:--i={n}
						class="enter-rise min-h-11 rounded-full border border-border bg-surface px-4 py-2 text-left type-label text-text transition-[background-color,transform] duration-(--dur-state) hover:-translate-y-0.5 hover:bg-surface-2"
						onclick={() => ((text = c), send())}>{c}</button
					>
				{/each}
			</div>
		{/if}
		<form
			onsubmit={send}
			class="field mx-4 flex items-end gap-1 rounded-[26px] p-1 transition-shadow duration-(--dur-state) focus-within:shadow-[0_0_0_4px_var(--kokum-50)]"
		>
			<!-- Snap and ask (P12): a photo, with the typed text as its question. -->
			<label
				class="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-2 hover:text-text"
			>
				<span class="sr-only">{m.snap_button()}</span>
				<Camera size={22} aria-hidden="true" />
				<input
					type="file"
					accept="image/*"
					capture="environment"
					class="sr-only"
					data-testid="snap-input"
					onchange={async (e) => {
						const f = e.currentTarget.files?.[0];
						e.currentTarget.value = '';
						if (!f) return;
						const caption = text;
						text = '';
						await snap(f, caption);
					}}
				/>
			</label>
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
				class="flex size-11 shrink-0 items-center justify-center rounded-full bg-kokum text-on-kokum transition-[background-color,color,transform] duration-(--dur-state) ease-(--ease-spring) enabled:hover:scale-105 enabled:active:scale-90 disabled:bg-surface-3 disabled:text-text-2"
				aria-label={m.crabby_send()}
			>
				{#if crabby.busy}
					<span
						class="size-5 animate-spin rounded-full border-2 border-current border-t-transparent"
						aria-hidden="true"
					></span>
				{:else}
					<ArrowUp size={20} aria-hidden="true" />
				{/if}
			</button>
		</form>
		<p class="px-6 pt-2 pb-3 text-center type-label text-text-2">
			{#if crabby.remaining != null}<span class="tabular-nums"
					>{m.crabby_remaining({ n: crabby.remaining })} ·
				</span>{/if}{m.crabby_disclaimer()}
		</p>
	{/if}
</div>

{#if crabby.emergency}
	<EmergencyCard onclose={() => (crabby.emergency = false)} />
{/if}
