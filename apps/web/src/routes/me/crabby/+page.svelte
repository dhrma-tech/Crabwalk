<script lang="ts">
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { submitting } from '#lib/forms.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import IconButton from '#lib/components/IconButton.svelte';
	import Crabby from '#lib/components/Crabby.svelte';
	import type { PageProps } from './$types';

	// Crabby & you (P12 step D, product plan 10.7 + 10.9): tell Crabby about you, see and correct what it thinks,
	// choose what it learns from, and its style. Nothing here reaches the AI except a short summary of the lines.
	let { data, form }: PageProps = $props();
	const p = $derived(data.profile);
	const CATS = [
		'beach',
		'fort',
		'temple',
		'waterfall',
		'viewpoint',
		'backwater',
		'cave',
		'museum',
		'village',
		'market',
		'orchard'
	];
	const SOURCES = [
		['use_quiz', m.source_quiz],
		['use_activity', m.source_activity],
		['use_chats', m.source_chats],
		['use_trips', m.source_trips],
		['use_photos', m.source_photos]
	] as const;
	const SRC: Record<string, () => string> = {
		quiz: m.src_quiz,
		activity: m.src_activity,
		chat: m.src_chat,
		trips: m.src_trips,
		user: m.src_user
	};
	let editing = $state<string | null>(null);
	const field = 'field h-12 px-3 type-body text-text';
	const label = 'flex flex-col gap-1.5 type-small text-text-2';
	const card = 'flex flex-col gap-4 rounded-lg bg-surface p-4 shadow-e1';
</script>

<Page title={m.crabby_me_title()}>
	<div class="flex flex-col gap-8">
		<header class="flex items-center gap-4">
			<Crabby size={56} />
			<p class="type-body text-text-2">{m.crabby_me_hint()}</p>
		</header>

		<section class="flex flex-col gap-3" data-testid="thinks">
			<h2 class="type-h2">{m.thinks_title()}</h2>
			<div class={card}>
				{#if !data.lines.length}
					<p class="type-body text-text-2">{m.thinks_empty()}</p>
				{/if}
				<ul class="flex flex-col gap-2">
					{#each data.lines as l (l.id)}
						<li class="flex items-start gap-2" data-testid="thinks-line">
							{#if editing === l.id}
								<form
									method="POST"
									action="?/edit"
									use:submitting
									class="flex flex-1 flex-wrap gap-2"
								>
									<input type="hidden" name="id" value={l.id} />
									<input
										name="text"
										value={l.text}
										maxlength="120"
										aria-label={m.thinks_edit()}
										class="field h-11 min-w-0 flex-1 basis-56 px-3 type-body text-text"
									/>
									<Button type="submit" variant="secondary">{m.thinks_save_line()}</Button>
								</form>
							{:else}
								<p class="min-w-0 flex-1 py-2.5 type-body">{l.text}</p>
								<span
									class="mt-2.5 shrink-0 rounded-full bg-surface-2 px-2 py-0.5 type-label text-text-2"
									>{SRC[l.source]?.()}</span
								>
								<IconButton label={m.thinks_edit()} onclick={() => (editing = l.id)}
									><Pencil size={18} aria-hidden="true" /></IconButton
								>
								<form method="POST" action="?/hide" use:submitting>
									<input type="hidden" name="id" value={l.id} />
									<IconButton type="submit" label={m.thinks_delete()}
										><Trash2 size={18} aria-hidden="true" /></IconButton
									>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
				<form
					method="POST"
					action="?/reset"
					use:submitting
					onsubmit={(e) => {
						if (!confirm(m.thinks_reset_confirm())) e.preventDefault();
					}}
				>
					<Button type="submit" variant="ghost">{m.thinks_reset()}</Button>
				</form>
			</div>
		</section>

		<form
			method="POST"
			action="?/quiz"
			use:submitting
			class="flex flex-col gap-3"
			data-testid="quiz"
		>
			<h2 class="type-h2">{m.quiz_title()}</h2>
			<div class={card}>
				<div class="grid gap-4 sm:grid-cols-2">
					<label class={label}
						>{m.quiz_vehicle()}
						<select name="vehicle" class={field}>
							<option value="">{m.filter_any()}</option>
							{#each ['car', 'two_wheeler', 'public_transport'] as v (v)}
								<option value={v} selected={p.vehicle === v}>{msg(`vehicle_${v}`)}</option>
							{/each}
						</select>
					</label>
					<label class={label}
						>{m.quiz_mileage()}
						<input
							name="mileage_kmpl"
							type="number"
							inputmode="decimal"
							min="5"
							max="100"
							step="0.5"
							value={p.mileage_kmpl ?? ''}
							class={field}
						/>
					</label>
					<label class={label}
						>{m.plan_budget()}
						<select name="budget_band" class={field}>
							<option value="">{m.filter_any()}</option>
							{#each ['budget', 'mid', 'premium'] as b (b)}
								<option value={b} selected={p.budget_band === b}>{msg(`budget_level_${b}`)}</option>
							{/each}
						</select>
					</label>
					<label class={label}
						>{m.plan_pace()}
						<select name="pace" class={field}>
							<option value="">{m.filter_any()}</option>
							{#each ['relaxed', 'balanced', 'packed'] as v (v)}
								<option value={v} selected={p.pace === v}>{msg(`pace_${v}`)}</option>
							{/each}
						</select>
					</label>
					<label class={label}
						>{m.plan_diet()}
						<select name="diet" class={field}>
							<option value="">{m.filter_any()}</option>
							<option value="veg" selected={p.diet === 'veg'}>{m.diet_veg()}</option>
							<option value="non_veg" selected={p.diet === 'non_veg'}>{m.diet_nonveg()}</option>
							<option value="jain" selected={p.diet === 'jain'}>{m.diet_jain()}</option>
						</select>
					</label>
					<label class={label}
						>{m.quiz_seafood()}
						<select name="seafood" class={field}>
							<option value="">{m.filter_any()}</option>
							<option value="yes" selected={p.seafood === true}>{m.quiz_seafood_yes()}</option>
							<option value="no" selected={p.seafood === false}>{m.quiz_seafood_no()}</option>
						</select>
					</label>
					<label class={label}
						>{m.plan_group()}
						<select name="group_type" class={field}>
							<option value="">{m.filter_any()}</option>
							{#each ['family', 'couple', 'friends', 'solo'] as g (g)}
								<option value={g} selected={p.group_type === g}>{msg(`group_${g}`)}</option>
							{/each}
						</select>
					</label>
				</div>
				<fieldset class="flex flex-col gap-2">
					<legend class="mb-1.5 type-small text-text-2">{m.quiz_interests()}</legend>
					<div class="flex flex-wrap gap-2">
						{#each CATS as c (c)}
							<label
								class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-surface-2 px-3.5 type-label text-text has-checked:bg-kokum has-checked:text-on-kokum"
							>
								<input
									type="checkbox"
									name="interests"
									value={c}
									checked={p.interests.includes(c as never)}
									class="sr-only"
								/>{msg(`cat_${c}`)}
							</label>
						{/each}
					</div>
				</fieldset>
				<div class="flex items-center gap-3">
					<Button type="submit">{m.quiz_save()}</Button>
					{#if form?.saved === 'quiz'}<p class="type-small" role="status">{m.owner_saved()}</p>{/if}
				</div>
			</div>
		</form>

		<form
			method="POST"
			action="?/sources"
			use:submitting
			class="flex flex-col gap-3"
			data-testid="sources"
		>
			<h2 class="type-h2">{m.sources_title()}</h2>
			<div class={card}>
				<p class="type-small text-text-2">{m.source_note()}</p>
				{#each SOURCES as [name, text] (name)}
					<label class="flex min-h-11 items-center justify-between gap-4">
						<span class="type-body">{text()}</span>
						<input
							type="checkbox"
							role="switch"
							{name}
							checked={p[name]}
							class="size-6 shrink-0 accent-kokum"
						/>
					</label>
				{/each}
				<div class="flex items-center gap-3">
					<Button type="submit" variant="secondary">{m.quiz_save()}</Button>
					{#if form?.saved === 'sources'}<p class="type-small" role="status">
							{m.owner_saved()}
						</p>{/if}
				</div>
			</div>
		</form>

		<form
			method="POST"
			action="?/persona"
			use:submitting
			class="flex flex-col gap-3"
			data-testid="persona"
		>
			<h2 class="type-h2">{m.persona_title()}</h2>
			<fieldset class={card}>
				<legend class="sr-only">{m.persona_title()}</legend>
				{#each [['playful', m.persona_playful, m.persona_playful_hint], ['plain', m.persona_plain, m.persona_plain_hint]] as const as [v, name, hint] (v)}
					<label class="flex min-h-11 items-start gap-3">
						<input
							type="radio"
							name="persona"
							value={v}
							checked={p.persona === v}
							class="mt-1 size-5 shrink-0 accent-kokum"
						/>
						<span class="flex flex-col">
							<span class="type-body-strong">{name()}</span>
							<span class="type-small text-text-2">{hint()}</span>
						</span>
					</label>
				{/each}
				<div class="flex items-center gap-3">
					<Button type="submit" variant="secondary">{m.quiz_save()}</Button>
					{#if form?.saved === 'persona'}<p class="type-small" role="status">
							{m.owner_saved()}
						</p>{/if}
				</div>
			</fieldset>
		</form>
	</div>
</Page>
