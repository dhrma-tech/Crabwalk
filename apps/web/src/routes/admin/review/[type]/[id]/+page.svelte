<script lang="ts">
	import { submitting } from '#lib/forms.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let tab = $state<'en' | 'hi' | 'mr'>('en');
	const tabs = [
		{ k: 'en', label: 'English' },
		{ k: 'hi', label: 'हिन्दी' },
		{ k: 'mr', label: 'मराठी' }
	] as const;
	const long = (f: string) => f !== 'name';
	const LABEL: Record<string, () => string> = {
		name: m.label_name,
		description: m.label_description,
		short_story: m.place_story,
		history: m.place_history,
		significance: m.place_significance,
		dos: m.place_dos,
		donts: m.place_donts,
		safety_text: m.place_safety,
		what_it_is: m.dish_what,
		story: m.dish_story
	};
	let duration = $state(0);
	function readDuration(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const a = new Audio(URL.createObjectURL(file));
		a.onloadedmetadata = () => (duration = Math.round(a.duration));
	}
	const field = 'field w-full p-3 type-body text-text';
</script>

<Page title={data.text.en.name ?? msg(`type_${data.type}`)} back tool>
	<div class="mx-auto flex max-w-170 flex-col gap-4">
		<form
			method="POST"
			action="?/draft"
			use:submitting
			class="flex flex-col gap-3 rounded-lg bg-lagoon-50 p-4 text-text"
		>
			<p class="type-small">{m.review_ai_pending()}</p>
			<div><Button type="submit" variant="secondary">{m.review_ai_draft()}</Button></div>
			{#if form?.drafted != null}<p class="type-small" role="status">
					{m.review_ai_drafted({ n: form.drafted })}
				</p>{/if}
			{#if form?.error === 'draft'}<p class="type-small" role="alert">
					{m.crabby_unavailable()}
				</p>{/if}
		</form>

		{#if data.photos.length}
			<div class="flex flex-wrap gap-2">
				{#each data.photos as p, i (i)}<img
						src={p.src}
						alt=""
						class="size-24 rounded-md object-cover"
					/>{/each}
			</div>
		{/if}

		<details class="rounded-lg bg-surface p-3 shadow-e1">
			<summary class="min-h-11 cursor-pointer type-h3">{m.facts()}</summary>
			<dl class="mt-2 grid gap-1 type-small">
				{#each Object.entries(data.facts) as [k, v] (k)}
					<div class="grid grid-cols-[10rem_1fr] gap-2">
						<dt class="text-text-2">{k}</dt>
						<dd class="break-words">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
					</div>
				{/each}
			</dl>
		</details>

		{#if data.notes.length}
			<section class="flex flex-col gap-2">
				<h2 class="type-h2">{m.review_notes()}</h2>
				{#each data.notes as n, i (i)}<p
						class="rounded-lg bg-surface p-3 shadow-e1 type-body whitespace-pre-line"
					>
						{n.notes}
					</p>{/each}
			</section>
		{/if}

		<form
			method="POST"
			action="?/save"
			use:submitting
			class="flex flex-col gap-4"
			data-testid="review-form"
		>
			<div class="inline-flex w-fit rounded-full bg-surface-2 p-0.5" role="tablist">
				{#each tabs as t (t.k)}
					<button
						type="button"
						role="tab"
						aria-selected={tab === t.k}
						lang={t.k}
						class={[
							'min-h-11 rounded-full px-4 type-label',
							tab === t.k ? 'bg-surface text-text shadow-e1' : 'text-text-2 hover:text-text'
						]}
						onclick={() => (tab = t.k)}>{t.label}</button
					>
				{/each}
			</div>
			{#each tabs as t (t.k)}
				<div class={['flex flex-col gap-3', tab !== t.k && 'hidden']} lang={t.k}>
					{#each data.fields as f (f)}
						<label class="flex flex-col gap-1.5 type-small text-text-2">
							{LABEL[f]?.() ?? f}
							{#if long(f)}
								<textarea
									name={`${t.k}.${f}`}
									rows="4"
									class={field}
									value={data.text[t.k][f] ?? ''}></textarea>
							{:else}
								<input
									name={`${t.k}.${f}`}
									class={[field, 'h-12']}
									value={data.text[t.k][f] ?? ''}
								/>
							{/if}
						</label>
					{/each}
				</div>
			{/each}
			{#if form?.saved}<p class="type-small" role="status">{m.review_saved()}</p>{/if}
			{#if form?.published}<p class="type-small" role="status">{m.review_published()}</p>{/if}
			{#if form?.error}<p class="type-small" role="alert">{m.send_failed()}</p>{/if}
			<div class="flex flex-wrap gap-3">
				<Button type="submit" variant="secondary">{m.review_save()}</Button>
				<Button type="submit" formaction="?/publish">{m.review_publish()}</Button>
			</div>
		</form>

		{#if data.type === 'stay' && data.isAdmin}
			<section class="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-e1">
				<h2 class="type-h2">{m.offers_title()}</h2>
				{#each data.offers as o (o.id)}
					<form
						method="POST"
						action="?/removeOffer"
						use:submitting
						class="flex items-center justify-between gap-3 type-small"
					>
						<span>{o.provider} · {o.affiliate_network ?? '—'}</span>
						<input type="hidden" name="offer" value={o.id} />
						<Button type="submit" variant="ghost">{m.remove()}</Button>
					</form>
				{/each}
				<form method="POST" action="?/addOffer" use:submitting class="grid gap-2 sm:grid-cols-3">
					<input
						name="provider"
						placeholder={m.offer_provider()}
						required
						class={[field, 'h-12']}
					/>
					<input
						name="deep_link"
						type="url"
						placeholder={m.offer_link()}
						required
						pattern="https://.*"
						class={[field, 'h-12']}
					/>
					<select name="affiliate_network" class={[field, 'h-12']}>
						<option value="">{m.offer_network()}</option><option value="agoda_partners"
							>Agoda Partners</option
						><option value="inrdeals">INRDeals</option><option value="cuelinks">Cuelinks</option>
					</select>
					<div><Button type="submit" variant="secondary">{m.add()}</Button></div>
				</form>
			</section>
		{/if}

		{#if data.type === 'place'}
			<form
				method="POST"
				action="?/audio"
				enctype="multipart/form-data"
				use:submitting
				class="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-e1"
			>
				<h2 class="type-h2">{m.audio_upload()}</h2>
				<input
					type="file"
					name="file"
					accept="audio/mpeg,audio/mp4,audio/ogg,audio/webm"
					required
					onchange={readDuration}
				/>
				<input type="hidden" name="duration" value={duration} />
				<select name="lang" class={[field, 'h-12']}
					>{#each tabs as t (t.k)}<option value={t.k}>{t.label}</option>{/each}</select
				>
				<textarea name="transcript" rows="3" placeholder={m.audio_transcript()} class={field}
				></textarea>
				{#if form?.audio}<p class="type-small" role="status">{m.owner_saved()}</p>{/if}
				<div><Button type="submit" variant="secondary">{m.audio_upload()}</Button></div>
			</form>
		{/if}
	</div>
</Page>
