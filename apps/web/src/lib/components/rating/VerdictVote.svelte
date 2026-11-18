<script lang="ts">
	import ThumbsDown from '@lucide/svelte/icons/thumbs-down';
	import CircleMinus from '@lucide/svelte/icons/circle-minus';
	import ThumbsUp from '@lucide/svelte/icons/thumbs-up';
	import Star from '@lucide/svelte/icons/star';
	import Lock from '@lucide/svelte/icons/lock';
	import LockOpen from '@lucide/svelte/icons/lock-open';
	import Camera from '@lucide/svelte/icons/camera';
	import Check from '@lucide/svelte/icons/check';
	import { onMount, untrack } from 'svelte';
	import { invalidate } from '$app/navigation';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import { toast } from '#lib/toast.svelte.ts';
	import { dur, reducedMotion } from '#lib/motion.ts';
	import { processPhoto, type Processed } from '#lib/field/photos.ts';
	import Button from '../Button.svelte';
	import Crabby from '../Crabby.svelte';
	import Segmented from '../Segmented.svelte';
	import type { EntityType } from './VerdictGauge.svelte';
	import SignInButton from '#lib/components/SignInButton.svelte';
	import { live } from './live.svelte.ts';
	import { send } from '#lib/outbox.ts';
	import { track } from '#lib/track.ts';

	// FRONTEND §6.4 voting: 4 large verdict buttons (icon + label, no emoji) → optional quick-tap sub-scores →
	// optional text/photos. Hygiene/cleanliness taps locked with explanation unless verified (DB-enforced too).
	// Brief section 4.6 (T1-05): a tap shows at once (tile, gauge) and only this page's data reloads
	// (`invalidate('app:ratings')`); failure reverts it. The traveller group defaults to the one remembered; with
	// none, the person picks one first and the first vote remembers it.
	let {
		type,
		id,
		dims,
		mine,
		signedIn,
		guest = false
	}: {
		type: EntityType;
		id: string;
		dims: string[];
		mine: {
			verdicts: Partial<Record<string, number>>;
			subs: Record<string, number>;
			verified: boolean;
			proofPending: boolean;
			group: string | null;
		};
		signedIn: boolean;
		/** Anonymous session: the vote is stored but not counted (SEC-03). */
		guest?: boolean;
	} = $props();

	const groups = ['family', 'couple', 'solo', 'friends'] as const;
	type G = (typeof groups)[number];
	const icons = [ThumbsDown, CircleMinus, ThumbsUp, Star];
	const colours = ['var(--v1)', 'var(--v2)', 'var(--v3)', 'var(--v4)'];
	const isLockDim = (d: string) => d === 'hygiene' || d === 'cleanliness';
	const locked = (d: string) => isLockDim(d) && !mine.verified;
	let group = $state<G | null>(untrack(() => mine.group as G | null));
	let text = $state('');
	let photos = $state<Processed[]>([]);
	let busy = $state(false);
	let reviewed = $state(false);
	let proofFile = $state<FileList | undefined>();
	let proofSent = $state(false);

	onMount(() => {
		Object.assign(live, { id, group, verdicts: {}, pending: null });
	});
	$effect(() => {
		const g = group;
		if (live.id === id) untrack(() => (live.group = g));
	});
	const verdicts: Partial<Record<string, number>> = $derived(
		live.id === id ? { ...mine.verdicts, ...live.verdicts } : mine.verdicts
	);

	// Offline (T1-10, UX-15): the vote waits on this phone and the optimistic state stays.
	const post = (key: string, url: string, body: unknown) =>
		send(key, url, { method: 'POST', body });

	let tapped = $state<number | null>(null);
	let shaking = $state<number | null>(null);
	async function vote(level: number) {
		const g = group;
		if (!g) return;
		const prev = verdicts[g];
		// Optimistic, before any network work (section 4.12).
		live.verdicts[g] = level;
		if (!guest) live.pending = { group: g, prev, level };
		tapped = level;
		navigator.vibrate?.(12);
		const r = await post(`verdict:${type}:${id}:${g}`, '/api/verdicts', {
			entity_type: type,
			entity_id: id,
			group_type: g,
			level,
			...(mine.group ? {} : { remember: true })
		});
		if (!r || r.ok) track('vote', { kind: type, level, group: g });
		if (!r) return toast(m.outbox_queued());
		if (!r.ok) {
			if (prev) live.verdicts[g] = prev;
			else delete live.verdicts[g];
			live.pending = null;
			tapped = null;
			shaking = level;
			toast(m.outbox_failed());
			return;
		}
		await invalidate('app:ratings');
		if (live.pending?.group === g && live.pending.level === level) live.pending = null;
	}

	// Sub-scores: dots up to the value fill at once (30 ms stagger); the request waits until the choice settles,
	// so arrow keys can move through values (radio pattern) without a request per step.
	let subs = $state<Record<string, number>>({});
	const subVal = (d: string): number | undefined => subs[d] ?? mine.subs[d];
	const filled = (d: string, n: number) => {
		const v = subVal(d);
		return v !== undefined && (n === v || (n > 0 && n < v));
	};
	const timers: Record<string, ReturnType<typeof setTimeout>> = {};
	const rows: Record<string, HTMLElement> = $state({});
	function score(d: string, n: number) {
		if (locked(d)) return nudge(d);
		const before = subVal(d);
		subs[d] = n;
		const dots = rows[d]?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [];
		dots.forEach((el, i) => {
			if (i <= n && filled(d, i) && !reducedMotion.current)
				el.animate([{ transform: 'scale(.6)' }, { transform: 'scale(1)' }], {
					duration: 320,
					delay: i * 30,
					easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
					fill: 'backwards'
				});
		});
		clearTimeout(timers[d]);
		timers[d] = setTimeout(async () => {
			const r = await post(`sub:${type}:${id}:${d}`, '/api/subscores', {
				entity_type: type,
				entity_id: id,
				scores: { [d]: n }
			});
			if (!r || r.ok) track('subscore', { kind: type, dim: d });
			if (!r) return toast(m.outbox_queued());
			if (!r.ok) {
				if (before === undefined) delete subs[d];
				else subs[d] = before;
				toast(r.status === 403 ? m.verified_only_why() : m.outbox_failed());
				return;
			}
			await invalidate('app:ratings');
		}, 300);
	}
	function key(d: string, e: KeyboardEvent) {
		const v = subVal(d) ?? -1;
		const next = {
			ArrowRight: v + 1,
			ArrowDown: v + 1,
			ArrowLeft: v - 1,
			ArrowUp: v - 1,
			Home: 0,
			End: 5
		}[e.key];
		if (next === undefined) return;
		e.preventDefault();
		if (locked(d)) return nudge(d);
		const n = (next + 6) % 6;
		score(d, n);
		rows[d]?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[n]?.focus();
	}
	// A tap on a locked dot: the lock nudges 4 px once and the explanation scrolls into view.
	function nudge(d: string) {
		rows[d]
			?.querySelector('[data-lock]')
			?.animate([{ transform: 'none' }, { transform: 'translateX(4px)' }, { transform: 'none' }], {
				duration: dur(200),
				easing: 'ease-out'
			});
		rows[d]
			?.querySelector('[data-why]')
			?.scrollIntoView({ block: 'nearest', behavior: reducedMotion.current ? 'auto' : 'smooth' });
	}

	// Verified while the page is open (e.g. a proof approved, then this page's data reloaded): the lock opens.
	let wasVerified = untrack(() => mine.verified);
	let opened = $state(false);
	$effect(() => {
		const v = mine.verified;
		if (v && !wasVerified) {
			opened = true;
			setTimeout(() => (opened = false), 1500);
		}
		wasVerified = v;
	});

	async function addPhotos(e: Event) {
		for (const f of (e.target as HTMLInputElement).files ?? [])
			if (photos.length < 4) photos.push(await processPhoto(f));
		(e.target as HTMLInputElement).value = '';
	}
	async function review(e: SubmitEvent) {
		e.preventDefault();
		if (!group) return; // reviews are per traveller group, like votes
		busy = true;
		const f = new FormData();
		Object.entries({ entity_type: type, entity_id: id, group_type: group, text }).forEach(
			([k, v]) => f.set(k, v)
		);
		photos.forEach((p, i) => {
			for (const w of [480, 960] as const) {
				const b = p.blobs[w] ?? p.blobs[480];
				if (b) f.set(`p${i}_${w}`, new File([b], `${i}-${w}.webp`, { type: 'image/webp' }));
			}
			f.set(`p${i}_lqip`, p.lqip);
			f.set(`p${i}_w`, String(p.width));
			f.set(`p${i}_h`, String(p.height));
		});
		const r = await fetch('/api/reviews', { method: 'POST', body: f });
		busy = false;
		reviewed = r.ok;
		if (r.ok) track('review_submit', { kind: type, photos: photos.length });
		if (!r.ok) toast(m.send_failed());
	}
	async function proof(e: SubmitEvent) {
		e.preventDefault();
		const file = proofFile?.[0];
		if (!file) return;
		const f = new FormData();
		f.set('entity_type', type);
		f.set('entity_id', id);
		f.set('file', file);
		const r = await fetch('/api/booking-proofs', { method: 'POST', body: f });
		proofSent = r.ok;
		if (!r.ok) toast(m.send_failed());
	}
</script>

<section id="vote" class="flex scroll-mt-20 flex-col gap-4" data-testid="verdict-vote">
	<h2 class="type-h2">{m.vote_title()}</h2>
	{#if !signedIn}
		<div><SignInButton label={m.vote_signin()} variant="secondary" /></div>
	{:else}
		<div class="flex flex-col gap-1.5">
			<span class="type-small text-text-2">{m.vote_as()}</span>
			<div>
				<Segmented
					bind:value={group}
					label={m.vote_as()}
					options={groups.map((g) => ({ value: g, label: msg(`group_${g}`) }))}
				/>
			</div>
			{#if !group}<p class="type-small text-text-2" id={`pick-${id}`} data-testid="vote-pick-group">
					{m.vote_pick_group()}
				</p>{/if}
		</div>

		<!-- Report 2 §8: 2×2 tiles (4×1 on wide screens); the chosen one gets its verdict colour + a check. -->
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
			{#each [1, 2, 3, 4] as level (level)}
				{@const Icon = icons[level - 1]}
				{@const on = !!group && verdicts[group] === level}
				<button
					type="button"
					aria-pressed={on}
					disabled={!group}
					aria-describedby={group ? undefined : `pick-${id}`}
					class={[
						'group/press relative flex min-h-20 flex-col items-center justify-center rounded-md border-2 px-2 py-3 type-body-strong text-text',
						'transition-[background-color,border-color] duration-(--dur-press) ease-brand disabled:opacity-60',
						on ? '' : 'border-transparent bg-surface-2 enabled:hover:bg-surface-3',
						tapped !== null && tapped !== level && 'dim',
						shaking === level && 'shake'
					]}
					style:border-color={on ? colours[level - 1] : undefined}
					style:background-color={on
						? `color-mix(in srgb, ${colours[level - 1]} 14%, var(--surface))`
						: undefined}
					onclick={() => vote(level)}
					onanimationend={(e) => {
						if (e.animationName.endsWith('shake')) shaking = null;
						if (e.animationName.endsWith('tilt')) tapped = null;
					}}
				>
					{#if on}<Check
							size={16}
							aria-hidden="true"
							class={['absolute top-2 right-2', tapped === level && 'pop']}
						/>{/if}
					<span
						class="flex flex-col items-center gap-1.5 transition-transform duration-(--dur-press) ease-brand group-enabled/press:group-active/press:scale-[.97]"
						><span class={['flex', tapped === level && 'tilt']}
							><Icon size={24} aria-hidden="true" /></span
						>{msg(`verdict_${type}_${level}`)}</span
					>
				</button>
			{/each}
		</div>
		{#if guest}
			<p class="type-small text-text-2" data-testid="vote-guest-note">{m.vote_guest_note()}</p>
		{/if}

		{#if dims.length}
			<div class="flex flex-col gap-3">
				<h3 class="type-h3">{m.subscores_title()}</h3>
				{#each dims as d (d)}
					{@const v = subVal(d)}
					<div
						bind:this={rows[d]}
						class={[
							'flex flex-col gap-1.5 rounded-md outline-offset-4 transition-[outline-color] duration-(--dur-state)',
							opened && isLockDim(d) ? 'outline-2 outline-lagoon' : 'outline-transparent'
						]}
						data-testid={`tap-${d}`}
					>
						<span class="flex items-center gap-1 type-small"
							>{#if isLockDim(d)}<span data-lock class={['flex', opened && 'pop']}
									>{#if mine.verified}<LockOpen size={14} aria-hidden="true" />{:else}<Lock
											size={14}
											aria-hidden="true"
										/>{/if}</span
								>{/if}{msg(`dim_${d}`)}</span
						>
						<div
							class="flex flex-wrap gap-1.5"
							role="radiogroup"
							tabindex="-1"
							aria-label={msg(`dim_${d}`)}
							aria-describedby={locked(d) ? `why-${d}-${id}` : undefined}
							onkeydown={(e) => key(d, e)}
						>
							{#each [0, 1, 2, 3, 4, 5] as n (n)}
								<button
									type="button"
									role="radio"
									aria-checked={v === n}
									aria-disabled={locked(d) || undefined}
									tabindex={v === n || (v === undefined && n === 0) ? 0 : -1}
									aria-label={m.score_of({ dim: msg(`dim_${d}`), n })}
									class={[
										'size-11 rounded-full type-label transition-colors duration-(--dur-state)',
										locked(d)
											? 'bg-surface-2 text-muted'
											: filled(d, n)
												? 'bg-text text-bg'
												: 'bg-surface-2 text-text hover:bg-surface-3'
									]}
									onclick={() => score(d, n)}>{n}</button
								>
							{/each}
						</div>
						{#if locked(d)}<p class="type-small text-text-2" id={`why-${d}-${id}`} data-why>
								{m.verified_only()} — {m.verified_only_why()}
							</p>{/if}
					</div>
				{/each}
				{#if !mine.verified && type !== 'place'}
					{#if proofSent || mine.proofPending}
						<p class="type-small" role="status">{m.proof_sent()}</p>
					{:else}
						<form onsubmit={proof} class="flex flex-col gap-2 rounded-md bg-surface-2 p-4">
							<h4 class="type-h3" id={`proof-${id}`}>{m.proof_title()}</h4>
							<p class="type-small text-text-2">{m.proof_body()}</p>
							<input
								type="file"
								accept="image/jpeg,image/png,image/webp"
								bind:files={proofFile}
								required
								aria-labelledby={`proof-${id}`}
								class="type-small"
							/>
							<div><Button type="submit" variant="outline">{m.proof_send()}</Button></div>
						</form>
					{/if}
				{/if}
			</div>
		{/if}

		<!-- Sent: the form folds away (`grid-template-rows` 1fr → 0fr, --dur-sheet) into the status line. -->
		<div
			class={[
				'grid transition-[grid-template-rows] duration-(--dur-sheet) ease-brand',
				reviewed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
			]}
			inert={reviewed}
		>
			<div class="-m-1 min-h-0 overflow-hidden p-1">
				<form onsubmit={review} class="flex flex-col gap-2">
					<label class="flex flex-col gap-1.5 type-small text-text-2"
						>{m.review_write()}
						<textarea
							bind:value={text}
							maxlength="2000"
							rows="3"
							class="field p-3 type-body text-text"></textarea>
					</label>
					<label
						class="flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-full bg-surface-2 px-4 type-label text-text hover:bg-surface-3 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
					>
						<Camera size={20} aria-hidden="true" />{m.review_photos()}
						<input type="file" accept="image/*" multiple class="sr-only" onchange={addPhotos} />
					</label>
					{#if photos.length}<p class="type-small text-text-2">{photos.length}/4</p>{/if}
					<div>
						<Button
							type="submit"
							variant="secondary"
							loading={busy}
							disabled={!group || (!text.trim() && !photos.length)}>{m.review_send()}</Button
						>
					</div>
				</form>
			</div>
		</div>
		{#if reviewed}
			<div class="flex items-center gap-2 enter-rise" role="status">
				<Crabby size={32} waving />
				<p class="flex flex-col type-body">
					{m.review_pending()}<span class="type-small text-text-2">{m.review_expect()}</span>
				</p>
			</div>
		{/if}
	{/if}
</section>

<style>
	/* Section 4.6: the chosen tile's icon tilts 12° and back; the others dim for --dur-state; a failed vote shakes
	   the tile (3 × 4 px). The global reduced-motion rule makes these instant. */
	.tilt {
		animation: tilt var(--dur-emph) var(--ease-spring);
	}
	@keyframes tilt {
		50% {
			transform: rotate(12deg);
		}
	}
	.dim {
		animation: dim calc(var(--dur-state) * 2) var(--ease-inout);
	}
	@keyframes dim {
		50% {
			opacity: 0.6;
		}
	}
	.shake {
		animation: shake var(--dur-state) linear;
	}
	@keyframes shake {
		20%,
		60% {
			transform: translateX(-4px);
		}
		40%,
		80% {
			transform: translateX(4px);
		}
	}
</style>
