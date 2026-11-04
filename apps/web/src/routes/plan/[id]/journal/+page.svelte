<script lang="ts">
	import { onMount } from 'svelte';
	import FileDown from '@lucide/svelte/icons/file-down';
	import Link from '@lucide/svelte/icons/link';
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import { SUPABASE_URL } from '$app/env/public';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { submitting } from '#lib/forms.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { formatINR } from '#lib/format.ts';
	import { toast } from '#lib/toast.svelte.ts';
	import { processPhoto } from '#lib/field/photos.ts';
	import { addMedia, listMedia, removeMedia, type LocalMedia } from '#lib/journal-media.ts';
	import Meta from '#lib/components/Meta.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import Button from '#lib/components/Button.svelte';
	import VoiceField from '#lib/components/VoiceField.svelte';
	import type { PageProps } from './$types';

	// Trip journal (P12 step M, 10.10): filled from the trip; the user answers a line per stop (typed or spoken);
	// Crabby writes the story only from those answers and the trip. Photos and clips stay on this phone; a photo
	// the user shares goes into the journal. Private until the user turns on the share link.
	let { data, form }: PageProps = $props();
	const t = $derived(data.trip);
	// svelte-ignore state_referenced_locally
	let answers = $state<Record<string, string>>(
		Object.fromEntries(
			[...data.trip.stops.map((s) => s.key), 'trip'].map((k) => [k, data.journal?.answers[k] ?? ''])
		)
	);
	const byDay = $derived(
		Array.from({ length: t.days }, (_, i) => ({
			day: i + 1,
			stops: t.stops.filter((s) => s.day === i + 1)
		})).filter((d) => d.stops.length)
	);
	const photoUrl = (p: string) => `${SUPABASE_URL}/storage/v1/object/public/journal/${p}`;

	// On the phone only (IndexedDB): photos and clips, shown with object URLs.
	let media = $state<(LocalMedia & { url: string })[]>([]);
	let sharing = $state<string | null>(null);
	async function refresh() {
		for (const x of media) URL.revokeObjectURL(x.url);
		media = (await listMedia(data.tripId).catch(() => [])).map((x) => ({
			...x,
			url: URL.createObjectURL(x.blob)
		}));
	}
	onMount(() => {
		void refresh();
		return () => media.forEach((x) => URL.revokeObjectURL(x.url));
	});
	async function add(e: Event & { currentTarget: HTMLInputElement }) {
		const input = e.currentTarget; // null once the first await yields
		for (const f of [...(input.files ?? [])]) await addMedia(data.tripId, f).catch(() => {});
		input.value = '';
		await refresh();
	}
	async function share(x: LocalMedia) {
		sharing = x.id;
		try {
			const p = await processPhoto(new File([x.blob], 'photo', { type: x.type }));
			const b = p.blobs[960] ?? p.blobs[480];
			const f = new FormData();
			f.set('photo', new File([b!], 'photo.webp', { type: 'image/webp' }));
			const r = await fetch(`/api/journal/${data.tripId}/photos`, { method: 'POST', body: f });
			if (r.status === 429) return toast(m.journal_photo_cap());
			if (!r.ok) return toast(m.send_failed());
			await invalidateAll();
		} finally {
			sharing = null;
		}
	}
	async function unshare(id: string) {
		const r = await fetch(`/api/journal/${data.tripId}/photos?photo=${id}`, { method: 'DELETE' });
		if (!r.ok) return toast(m.send_failed());
		await invalidateAll();
	}
	async function copyShare() {
		await navigator.clipboard
			?.writeText(`${page.url.origin}/journal/${data.journal?.share_token}`)
			.catch(() => {});
		toast(m.plan_link_copied());
	}
	const keep =
		() =>
		async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
			update({ reset: false });
</script>

<Meta title={`${m.journal_title()} · ${t.title}`} />
<TopBar title={m.journal_title()} back />
<main id="main" class="mx-auto flex w-full max-w-190 flex-col gap-8 px-5 py-6">
	<header class="flex flex-col gap-1">
		<h1 class="type-h1">{t.title}</h1>
		{#if t.spent}<p class="type-small text-text-2">
				{m.journal_spent({ amount: formatINR(t.spent) })}
			</p>{/if}
	</header>

	{#if data.journal?.story}
		<section class="flex flex-col gap-3" data-testid="journal-story">
			<h2 class="type-h2">{m.journal_story()}</h2>
			<p class="type-body whitespace-pre-line">{data.journal.story}</p>
			{#if data.journal.journal_photos.length}
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
					{#each data.journal.journal_photos as p (p.id)}
						<img
							src={photoUrl(p.path)}
							alt={p.caption ?? ''}
							class="aspect-square w-full rounded-md object-cover"
						/>
					{/each}
				</div>
			{/if}
			<div class="flex flex-wrap gap-2 print:hidden">
				<Button variant="secondary" onclick={() => window.print()}>
					{#snippet icon()}<FileDown size={20} aria-hidden="true" />{/snippet}{m.plan_pdf()}
				</Button>
				<form method="POST" action="?/share" use:submitting>
					<input type="hidden" name="on" value={data.journal.share_token ? '0' : '1'} />
					<Button type="submit" variant="ghost"
						>{data.journal.share_token ? m.journal_share_off() : m.journal_share_on()}</Button
					>
				</form>
				{#if data.journal.share_token}
					<Button variant="ghost" onclick={copyShare}>
						{#snippet icon()}<Link size={20} aria-hidden="true" />{/snippet}{m.journal_copy()}
					</Button>
				{/if}
			</div>
			<p class="type-small text-text-2 print:hidden" data-testid="journal-privacy">
				{data.journal.share_token ? m.journal_shared() : m.journal_private()}
			</p>
		</section>
	{/if}

	<section class="flex flex-col gap-4 print:hidden" data-testid="journal-interview">
		<div class="flex flex-col gap-1">
			<h2 class="type-h2">{m.journal_interview()}</h2>
			<p class="type-small text-text-2">{m.journal_interview_hint()}</p>
		</div>
		{#if !byDay.length}<p class="type-body">{m.journal_empty()}</p>{/if}
		{#each byDay as d (d.day)}
			<div class="flex flex-col gap-3">
				<h3 class="type-h3">{m.plan_day_n({ n: d.day })}</h3>
				{#each d.stops as s (s.key)}
					<div class="flex flex-col gap-1.5">
						<p class="flex flex-wrap items-center gap-x-3 type-small text-text-2">
							<span>{m.journal_how({ name: s.name })}</span>
							{#if s.visited}<span class="text-lagoon-ink">{m.journal_visited()}</span>{/if}
							<!-- One tap from a journal line to the place's vote / review. -->
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- listing route from our server -->
							<a href={`${s.href}#vote`}>{m.journal_vote()}</a>
						</p>
						<VoiceField bind:value={answers[s.key]} label={m.journal_how({ name: s.name })} />
					</div>
				{/each}
			</div>
		{/each}
		<div class="flex flex-col gap-1.5">
			<p class="type-small text-text-2">{m.journal_whole()}</p>
			<VoiceField bind:value={answers.trip} label={m.journal_whole()} rows={3} />
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<form method="POST" action="?/save" use:submitting={keep}>
				<input type="hidden" name="answers" value={JSON.stringify(answers)} />
				<Button type="submit" variant="secondary">{m.journal_save()}</Button>
			</form>
			<form method="POST" action="?/write" use:submitting={keep}>
				<Button type="submit"
					>{data.journal?.story ? m.journal_rewrite() : m.journal_write()}</Button
				>
			</form>
			{#if form?.saved}<p class="type-small" role="status">{m.journal_saved()}</p>{/if}
			{#if form?.limit}<p class="type-small" role="status">{m.crabby_limit()}</p>{/if}
		</div>
	</section>

	<section class="flex flex-col gap-3 print:hidden" data-testid="journal-media">
		<div class="flex flex-col gap-1">
			<h2 class="type-h2">{m.journal_media()}</h2>
			<p class="type-small text-text-2">{m.journal_media_hint()}</p>
		</div>
		<label
			class="inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-full bg-surface-2 px-4 type-label"
		>
			<ImagePlus size={20} aria-hidden="true" />{m.journal_add_media()}
			<input
				type="file"
				accept="image/*,video/*"
				multiple
				class="sr-only"
				data-testid="journal-add"
				onchange={add}
			/>
		</label>
		<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
			{#each media as x (x.id)}
				<li class="flex flex-col gap-1.5" data-testid="journal-local">
					{#if x.type.startsWith('video/')}
						<!-- The user's own clip: no captions to offer. -->
						<!-- svelte-ignore a11y_media_has_caption -->
						<video src={x.url} controls class="aspect-square w-full rounded-md bg-surface-2"
						></video>
					{:else}
						<img src={x.url} alt="" class="aspect-square w-full rounded-md object-cover" />
					{/if}
					<div class="flex flex-wrap gap-1">
						{#if !x.type.startsWith('video/')}
							<Button variant="secondary" loading={sharing === x.id} onclick={() => share(x)}
								>{m.journal_share_photo()}</Button
							>
						{/if}
						<Button variant="ghost" onclick={() => removeMedia(x.id).then(refresh)}
							>{m.journal_remove()}</Button
						>
					</div>
				</li>
			{/each}
		</ul>
		{#if data.journal?.journal_photos.length}
			<h3 class="type-h3">{m.journal_shared_photos()}</h3>
			<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="journal-shared">
				{#each data.journal.journal_photos as p (p.id)}
					<li class="flex flex-col gap-1.5">
						<img
							src={photoUrl(p.path)}
							alt={p.caption ?? ''}
							class="aspect-square w-full rounded-md object-cover"
						/>
						<Button variant="ghost" onclick={() => unshare(p.id)}>{m.journal_remove()}</Button>
					</li>
				{/each}
			</ul>
		{/if}
		<p class="type-small text-text-2">{m.journal_photo_cap()}</p>
	</section>
</main>
