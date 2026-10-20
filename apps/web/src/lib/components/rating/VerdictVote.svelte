<script lang="ts">
	import ThumbsDown from '@lucide/svelte/icons/thumbs-down';
	import CircleMinus from '@lucide/svelte/icons/circle-minus';
	import ThumbsUp from '@lucide/svelte/icons/thumbs-up';
	import Star from '@lucide/svelte/icons/star';
	import Lock from '@lucide/svelte/icons/lock';
	import Camera from '@lucide/svelte/icons/camera';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import { toast } from '#lib/toast.svelte.ts';
	import { processPhoto, type Processed } from '#lib/field/photos.ts';
	import Button from '../Button.svelte';
	import type { EntityType } from './VerdictGauge.svelte';

	// FRONTEND §6.4 voting: 4 large verdict buttons (icon + label, no emoji) → optional quick-tap sub-scores →
	// optional text/photos. Hygiene/cleanliness taps disabled with explanation unless verified (DB-enforced too).
	let {
		type,
		id,
		dims,
		mine,
		signedIn
	}: {
		type: EntityType;
		id: string;
		dims: string[];
		mine: {
			verdicts: Partial<Record<string, number>>;
			subs: Record<string, number>;
			verified: boolean;
			proofPending: boolean;
		};
		signedIn: boolean;
	} = $props();

	const groups = ['family', 'couple', 'solo', 'friends'] as const;
	const icons = [ThumbsDown, CircleMinus, ThumbsUp, Star];
	const locked = (d: string) => (d === 'hygiene' || d === 'cleanliness') && !mine.verified;
	let group = $state<(typeof groups)[number]>('family');
	let text = $state('');
	let photos = $state<Processed[]>([]);
	let busy = $state(false);
	let reviewed = $state(false);
	let proofFile = $state<FileList | undefined>();
	let proofSent = $state(false);

	const post = (url: string, body: unknown) =>
		fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

	async function vote(level: number) {
		const r = await post('/api/verdicts', {
			entity_type: type,
			entity_id: id,
			group_type: group,
			level
		});
		toast(r.ok ? m.vote_saved() : m.send_failed());
		if (r.ok) await invalidateAll();
	}
	async function score(dimension: string, value: number) {
		const r = await post('/api/subscores', {
			entity_type: type,
			entity_id: id,
			scores: { [dimension]: value }
		});
		toast(r.ok ? m.vote_saved() : r.status === 403 ? m.verified_only_why() : m.send_failed());
		if (r.ok) await invalidateAll();
	}
	async function addPhotos(e: Event) {
		for (const f of (e.target as HTMLInputElement).files ?? [])
			if (photos.length < 4) photos.push(await processPhoto(f));
		(e.target as HTMLInputElement).value = '';
	}
	async function review(e: SubmitEvent) {
		e.preventDefault();
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

<section class="flex flex-col gap-4 border-t border-text pt-4" data-testid="verdict-vote">
	<h2 class="type-h2">{m.vote_title()}</h2>
	{#if !signedIn}
		<div><Button href={resolve('/login')} variant="secondary">{m.vote_signin()}</Button></div>
	{:else}
		<div class="flex flex-col gap-1.5">
			<span class="type-small text-text-2">{m.vote_as()}</span>
			<div
				class="flex w-fit flex-wrap border border-text"
				role="radiogroup"
				aria-label={m.vote_as()}
			>
				{#each groups as g (g)}
					<button
						type="button"
						role="radio"
						aria-checked={group === g}
						class={['min-h-11 px-3 type-small', group === g ? 'bg-text text-bg' : 'text-text-2']}
						onclick={() => (group = g)}>{msg(`group_${g}`)}</button
					>
				{/each}
			</div>
		</div>

		<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
			{#each [1, 2, 3, 4] as level (level)}
				{@const Icon = icons[level - 1]}
				<button
					type="button"
					aria-pressed={mine.verdicts[group] === level}
					class={[
						'flex min-h-16 flex-col items-center justify-center gap-1 border border-text px-2 py-2 type-body',
						mine.verdicts[group] === level ? 'bg-text text-bg' : 'bg-bg text-text'
					]}
					onclick={() => vote(level)}
				>
					<Icon size={24} aria-hidden="true" />{msg(`verdict_${type}_${level}`)}
				</button>
			{/each}
		</div>

		{#if dims.length}
			<div class="flex flex-col gap-3">
				<h3 class="type-h3">{m.subscores_title()}</h3>
				{#each dims as d (d)}
					<div class="flex flex-col gap-1.5" data-testid={`tap-${d}`}>
						<span class="flex items-center gap-1 type-small"
							>{#if d === 'hygiene' || d === 'cleanliness'}<Lock
									size={14}
									aria-hidden="true"
								/>{/if}{msg(`dim_${d}`)}</span
						>
						<div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label={msg(`dim_${d}`)}>
							{#each [0, 1, 2, 3, 4, 5] as n (n)}
								<button
									type="button"
									role="radio"
									aria-checked={mine.subs[d] === n}
									disabled={locked(d)}
									aria-label={m.score_of({ dim: msg(`dim_${d}`), n })}
									class={[
										'size-11 border border-text type-small disabled:opacity-40',
										mine.subs[d] === n ? 'border-text bg-text text-bg' : 'bg-bg'
									]}
									onclick={() => score(d, n)}>{n}</button
								>
							{/each}
						</div>
						{#if locked(d)}<p class="type-small text-text-2">
								{m.verified_only()} — {m.verified_only_why()}
							</p>{/if}
					</div>
				{/each}
				{#if !mine.verified && type !== 'place'}
					{#if proofSent || mine.proofPending}
						<p class="type-small" role="status">{m.proof_sent()}</p>
					{:else}
						<form onsubmit={proof} class="flex flex-col gap-2 border border-border p-3">
							<h4 class="type-h3">{m.proof_title()}</h4>
							<p class="type-small text-text-2">{m.proof_body()}</p>
							<input
								type="file"
								accept="image/jpeg,image/png,image/webp"
								bind:files={proofFile}
								required
								class="type-small"
							/>
							<div><Button type="submit" variant="secondary">{m.proof_send()}</Button></div>
						</form>
					{/if}
				{/if}
			</div>
		{/if}

		{#if reviewed}
			<p class="type-body" role="status">{m.review_pending()}</p>
		{:else}
			<form onsubmit={review} class="flex flex-col gap-2">
				<label class="flex flex-col gap-1.5 type-small text-text-2"
					>{m.review_write()}
					<textarea
						bind:value={text}
						maxlength="2000"
						rows="3"
						class="border border-text bg-transparent p-3 type-body text-text"></textarea>
				</label>
				<label
					class="flex min-h-11 w-fit cursor-pointer items-center gap-2 border border-text px-4 type-small"
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
						disabled={!text.trim() && !photos.length}>{m.review_send()}</Button
					>
				</div>
			</form>
		{/if}
	{/if}
</section>
