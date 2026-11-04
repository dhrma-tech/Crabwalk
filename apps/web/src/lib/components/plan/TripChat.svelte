<script lang="ts">
	import Send from '@lucide/svelte/icons/send';
	import BarChart from '@lucide/svelte/icons/chart-no-axes-column';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Check from '@lucide/svelte/icons/check';
	import { m } from '#lib/paraglide/messages.js';
	import { toast } from '#lib/toast.svelte.ts';
	import type { ChatMessage } from '#lib/server/chat/trip-chat.ts';
	import Crabby from '../Crabby.svelte';
	import Button from '../Button.svelte';

	// Trip group chat (P12 step G, product plan 10.8): tripmates talk, share places, run polls (the old no-login
	// vote link is retired); Crabby answers when tagged and may chip in at planning moments. Its plan changes are
	// cards any editor applies. `tick` changes on every Realtime event for this trip's chat.
	let { tripId, editable, tick }: { tripId: string; editable: boolean; tick: number } = $props();

	let messages = $state<ChatMessage[]>([]);
	let text = $state('');
	let busy = $state(false);
	let mode = $state<'text' | 'poll' | 'share'>('text');
	let question = $state('');
	let options = $state(['', '']);
	let multi = $state(false);
	let q = $state('');
	let hits = $state<{ kind: 'place' | 'stay' | 'eatery'; slug: string; name: string }[]>([]);
	let list: HTMLElement | undefined = $state();

	const applied = $derived(
		new Set(
			messages.flatMap((x) =>
				x.kind === 'system' && x.payload?.applied ? [String(x.payload.applied)] : []
			)
		)
	);

	async function load() {
		const r = await fetch(`/api/trips/${tripId}/chat`).catch(() => null);
		if (!r?.ok) return;
		const atEnd = !list || list.scrollTop + list.clientHeight >= list.scrollHeight - 40;
		messages = (await r.json()) as ChatMessage[];
		if (atEnd) requestAnimationFrame(() => list?.scrollTo({ top: list.scrollHeight }));
	}
	$effect(() => {
		void tick;
		void load();
	});

	async function post(body: unknown) {
		busy = true;
		const r = await fetch(`/api/trips/${tripId}/chat`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}).catch(() => null);
		busy = false;
		if (r?.status === 422) toast(m.chat_refused());
		else if (!r?.ok) toast(m.send_failed());
		await load();
		return !!r?.ok;
	}
	async function sendText(e: SubmitEvent) {
		e.preventDefault();
		const t = text.trim();
		if (!t || busy) return;
		text = '';
		if (!(await post({ kind: 'text', body: t }))) text = t;
	}
	async function sendPoll(e: SubmitEvent) {
		e.preventDefault();
		const opts = options.map((o) => o.trim()).filter(Boolean);
		if (question.trim().length < 3 || opts.length < 2) return;
		if (await post({ kind: 'poll', question, options: opts, multi })) {
			question = '';
			options = ['', ''];
			multi = false;
			mode = 'text';
		}
	}
	let timer: ReturnType<typeof setTimeout>;
	function search() {
		clearTimeout(timer);
		if (q.trim().length < 2) return void (hits = []);
		timer = setTimeout(async () => {
			const r = await fetch(`/api/map/search?q=${encodeURIComponent(q.trim())}`).catch(() => null);
			const all: { kind: string; slug: string; name: string }[] = r?.ok ? await r.json() : [];
			hits = all.filter((h) => h.kind !== 'dish').slice(0, 6) as typeof hits;
		}, 300);
	}
	async function share(h: (typeof hits)[number]) {
		if (await post({ kind: 'card', type: h.kind, slug: h.slug })) {
			q = '';
			hits = [];
			mode = 'text';
		}
	}
	async function vote(x: ChatMessage, i: number) {
		const multiPoll = !!x.payload?.multi;
		const picks = multiPoll
			? x.picked?.includes(i)
				? x.picked.filter((p) => p !== i)
				: [...(x.picked ?? []), i]
			: [i];
		if (!picks.length) return;
		const r = await fetch(`/api/trips/${tripId}/chat/${x.id}/vote`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ options: picks })
		}).catch(() => null);
		if (!r?.ok) toast(m.send_failed());
		await load();
	}
	async function apply(x: ChatMessage) {
		const r = await fetch(`/api/trips/${tripId}/chat/${x.id}/apply`, { method: 'POST' }).catch(
			() => null
		);
		if (!r?.ok) toast(m.send_failed());
		await load();
	}
	const time = (iso: string) =>
		new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
			new Date(iso)
		);
	const tab = (on: boolean) => [
		'inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 type-label',
		on ? 'bg-kokum text-on-kokum' : 'bg-surface-2 text-text hover:bg-surface-3'
	];
</script>

<div class="flex flex-col gap-3" data-testid="trip-chat">
	<p class="type-small text-text-2">{m.chat_notice()}</p>
	<ol bind:this={list} class="flex max-h-[28rem] flex-col gap-2 overflow-y-auto" aria-live="polite">
		{#each messages as x (x.id)}
			<li
				class={[
					'flex max-w-[92%] flex-col gap-1',
					x.mine ? 'self-end items-end' : 'self-start',
					x.kind === 'system' && 'max-w-full self-center'
				]}
				data-testid="chat-message"
				data-kind={x.kind}
				data-crabby={x.crabby || undefined}
			>
				{#if x.kind === 'system'}
					<p class="flex items-center gap-1.5 type-small text-text-2">
						<Check size={14} aria-hidden="true" />{m.chat_applied({ title: x.body ?? '' })}
					</p>
				{:else}
					<p class="flex items-center gap-1.5 type-label text-text-2">
						{#if x.crabby}<Crabby size={20} />{m.nav_crabby()}{:else}{x.author ?? ''}{/if}
						<span aria-hidden="true">·</span><time datetime={x.at}>{time(x.at)}</time>
					</p>
					<div
						class={[
							'flex flex-col gap-2 rounded-lg px-3.5 py-2.5',
							x.mine ? 'bg-kokum-50 text-kokum-ink' : 'bg-surface shadow-e1'
						]}
					>
						{#if x.kind === 'poll'}
							{@const opts = (x.payload?.options as string[]) ?? []}
							{@const total = (x.tally ?? []).reduce((a, b) => a + b, 0)}
							<p class="type-body-strong">{x.body}</p>
							<ul class="flex flex-col gap-1.5" role="group" aria-label={x.body ?? ''}>
								{#each opts as o, i (i)}
									{@const mine = x.picked?.includes(i)}
									<li>
										<button
											type="button"
											aria-pressed={mine}
											class={[
												'flex min-h-11 w-full items-center justify-between gap-3 rounded-md border-[1.5px] px-3 text-left type-body',
												mine
													? 'border-kokum bg-kokum-50'
													: 'border-border-strong hover:bg-surface-2'
											]}
											onclick={() => vote(x, i)}
										>
											<span class="flex items-center gap-2"
												>{#if mine}<Check size={16} aria-hidden="true" />{/if}{o}</span
											>
											<span class="type-label text-text-2 tabular-nums">{x.tally?.[i] ?? 0}</span>
										</button>
									</li>
								{/each}
							</ul>
							<p class="type-small text-text-2">{m.chat_votes({ n: total })}</p>
						{:else if x.kind === 'report'}
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- report route from our server -->
							<a href={String(x.payload?.href ?? '')} class="type-body-strong"
								>{m.chat_report({ n: Number(x.payload?.version ?? 1) })} · {x.body}</a
							>
						{:else if x.kind === 'card' && x.payload?.listing}
							{@const l = x.payload.listing as { href: string }}
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- listing route from our server -->
							<a href={l.href} class="flex items-center gap-2 type-body-strong"
								><MapPin size={18} class="text-kokum" aria-hidden="true" />{x.body}</a
							>
						{:else if x.kind === 'card'}
							<p class="type-label text-text-2">{m.chat_proposed()}</p>
							<p class="type-body-strong">{x.body}</p>
							<ul class="flex flex-col gap-0.5">
								{#each (x.payload?.lines as string[]) ?? [] as l, k (k)}
									<li class="type-small text-text-2">{l}</li>
								{/each}
							</ul>
							{#if applied.has(x.id)}
								<p class="type-small text-text-2" role="status">{m.crabby_applied()}</p>
							{:else if editable}
								<div><Button onclick={() => apply(x)}>{m.chat_apply()}</Button></div>
							{:else}
								<p class="type-small text-text-2">{m.chat_editors_apply()}</p>
							{/if}
						{:else}
							<p class="type-body whitespace-pre-line">{x.body}</p>
						{/if}
					</div>
				{/if}
			</li>
		{:else}
			<li class="type-small text-text-2">{m.chat_empty()}</li>
		{/each}
	</ol>

	<div class="flex flex-wrap gap-2 print:hidden">
		<button
			type="button"
			class={tab(mode === 'poll')}
			onclick={() => (mode = mode === 'poll' ? 'text' : 'poll')}
			><BarChart size={16} aria-hidden="true" />{m.chat_poll()}</button
		>
		<button
			type="button"
			class={tab(mode === 'share')}
			onclick={() => (mode = mode === 'share' ? 'text' : 'share')}
			><MapPin size={16} aria-hidden="true" />{m.chat_share()}</button
		>
	</div>
	{#if mode === 'poll'}
		<form class="flex flex-col gap-2 print:hidden" onsubmit={sendPoll} data-testid="poll-form">
			<input
				bind:value={question}
				maxlength="200"
				aria-label={m.chat_poll_question()}
				placeholder={m.chat_poll_question()}
				class="field h-11 px-3 type-body text-text"
			/>
			{#each options.keys() as i (i)}
				<input
					bind:value={options[i]}
					maxlength="60"
					aria-label={m.chat_poll_option({ n: i + 1 })}
					placeholder={m.chat_poll_option({ n: i + 1 })}
					class="field h-11 px-3 type-body text-text"
				/>
			{/each}
			<div class="flex flex-wrap items-center gap-3">
				{#if options.length < 4}
					<Button variant="ghost" onclick={() => (options = [...options, ''])}
						>{m.chat_poll_add()}</Button
					>
				{/if}
				<label class="flex min-h-11 items-center gap-2 type-body">
					<input
						type="checkbox"
						bind:checked={multi}
						class="size-5 accent-kokum"
					/>{m.chat_poll_multi()}
				</label>
				<Button type="submit" loading={busy}>{m.chat_poll_post()}</Button>
			</div>
		</form>
	{:else if mode === 'share'}
		<div class="flex flex-col gap-2 print:hidden">
			<input
				type="search"
				bind:value={q}
				oninput={search}
				autocomplete="off"
				aria-label={m.chat_share_search()}
				placeholder={m.chat_share_search()}
				class="field h-11 px-3 type-body text-text"
			/>
			{#if hits.length}
				<ul class="flex flex-col rounded-md bg-surface shadow-e2" data-testid="chat-share-hits">
					{#each hits as h (h.kind + h.slug)}
						<li>
							<button
								type="button"
								class="row-link flex min-h-11 w-full items-center gap-2 px-3 text-left type-body text-text"
								onclick={() => share(h)}
								><MapPin size={18} class="text-text-2" aria-hidden="true" />{h.name}</button
							>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
	<form class="field flex items-end gap-1 rounded-xl p-0.5 print:hidden" onsubmit={sendText}>
		<textarea
			bind:value={text}
			rows="1"
			maxlength="1000"
			aria-label={m.chat_placeholder()}
			placeholder={m.chat_placeholder()}
			class="min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 type-body text-text placeholder:text-muted"
			onkeydown={(e) => {
				if (e.key === 'Enter' && !e.shiftKey) {
					e.preventDefault();
					e.currentTarget.form?.requestSubmit();
				}
			}}></textarea>
		<button
			type="submit"
			disabled={!text.trim() || busy}
			class="flex size-11 shrink-0 items-center justify-center rounded-full bg-kokum text-on-kokum disabled:bg-transparent disabled:text-muted"
			aria-label={m.chat_send()}><Send size={20} aria-hidden="true" /></button
		>
	</form>
</div>
