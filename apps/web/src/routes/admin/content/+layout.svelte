<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Plus from '@lucide/svelte/icons/plus';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import { DEFS, STATUS_LABEL, TYPES } from '#lib/admin/fields.ts';
	import { Constants } from '#lib/db.types.ts';
	import { TABLES } from '#lib/admin/tables.ts';
	import type { LayoutProps } from './$types';

	// Admin content editor: list + filters on the left, the entry on the right (laptops); phones show one at a time.
	let { data, children }: LayoutProps = $props();
	const detail = $derived(!!page.params.id);
	const search = $derived(page.url.search);
	const talukaName = $derived(Object.fromEntries(data.talukas.map((t) => [t.id, t.name])));
	const PLURAL = { place: 'Places', stay: 'Stays', eatery: 'Eateries', dish: 'Dishes' } as const;
	const human = (s: string) => s.replace(/_/g, ' ');
	const when = (ts: string | null) =>
		ts
			? new Date(ts).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' })
			: '';
	let filters: HTMLFormElement | undefined = $state();
	const submit = () => filters?.requestSubmit();
	const field =
		'min-h-11 w-full rounded-md border border-border-strong bg-surface px-2 type-body text-text';

	let creating = $state(false);
	let draft = $state({ name_en: '', taluka_id: '', category: '' });
	let problem = $state<string | null>(null);
	async function create(e: SubmitEvent) {
		e.preventDefault();
		problem = null;
		const res = await fetch(`/api/admin/content/${data.type}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name_en: draft.name_en,
				taluka_id: draft.taluka_id || null,
				category: draft.category || null
			})
		}).catch(() => null);
		const body = (await res?.json().catch(() => null)) as { id?: string; message?: string } | null;
		if (!res?.ok) return (problem = body?.message ?? 'Could not create the entry.');
		creating = false;
		draft = { name_en: '', taluka_id: '', category: '' };
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved route + query string
		goto(`${resolve('/admin/content/[type]/[id]', { type: data.type, id: body!.id! })}${search}`, {
			invalidate: ['admin:list']
		});
	}
</script>

<Page title="Content editor" back tool>
	<div class="lg:grid lg:grid-cols-[24rem_minmax(0,1fr)] lg:items-start lg:gap-6">
		<aside
			class={['flex flex-col gap-3 lg:sticky lg:top-24', detail && 'hidden lg:flex']}
			aria-label="Entries"
		>
			<form
				bind:this={filters}
				method="GET"
				action="/admin/content"
				class="flex flex-col gap-2"
				data-sveltekit-keepfocus
				data-sveltekit-noscroll
			>
				<nav class="grid grid-cols-4 gap-1 rounded-md bg-surface-2 p-1" aria-label="Type">
					{#each TYPES as t (t)}
						<a
							href="{resolve('/admin/content')}?type={t}"
							class={[
								'flex min-h-11 items-center justify-center rounded-sm type-label no-underline',
								data.type === t ? 'bg-surface text-text shadow-e1' : 'text-text-2'
							]}
							aria-current={data.type === t ? 'page' : undefined}>{PLURAL[t]}</a
						>
					{/each}
				</nav>
				<input type="hidden" name="type" value={data.type} />
				<input
					type="search"
					name="q"
					class={field}
					placeholder="Search name or ID"
					value={data.filters.q}
					aria-label="Search"
				/>
				<div class="grid grid-cols-2 gap-2">
					{#if data.type !== 'dish'}
						<select
							name="taluka"
							class={field}
							aria-label="Taluka"
							value={data.filters.taluka}
							onchange={submit}
						>
							<option value="">All talukas</option>
							{#each data.talukas as t (t.id)}<option value={t.id}>{t.name}</option>{/each}
						</select>
					{/if}
					<select
						name="cat"
						class={field}
						aria-label="Category or type"
						value={data.filters.cat}
						onchange={submit}
					>
						<option value="">All types</option>
						{#each data.cats as c (c)}<option value={c}>{human(c)}</option>{/each}
					</select>
					<select
						name="status"
						class={field}
						aria-label="Status"
						value={data.filters.status}
						onchange={submit}
					>
						<option value="">All statuses</option>
						{#each Constants.public.Enums.content_status as s (s)}<option value={s}
								>{STATUS_LABEL[s]}</option
							>{/each}
						<option value="archived">Archived</option>
					</select>
					<select
						name="sort"
						class={field}
						aria-label="Sort"
						value={data.filters.sort}
						onchange={submit}
					>
						<option value="complete">Least complete first</option>
						<option value="complete_desc">Most complete first</option>
						<option value="edited">Recently edited</option>
						<option value="name">Name</option>
					</select>
				</div>
				<label class="flex min-h-11 items-center gap-2 type-body">
					<input
						type="checkbox"
						name="missing"
						value="1"
						class="size-5"
						checked={data.filters.missing}
						onchange={submit}
					/>
					Missing required fields
				</label>
			</form>
			<div class="flex items-center gap-2">
				<p class="flex-1 type-small text-text-2" data-testid="list-count">
					{data.items.length} of {data.total}
				</p>
				<Button variant="secondary" onclick={() => (creating = !creating)}
					>{#snippet icon()}<Plus size={18} aria-hidden="true" />{/snippet}New {DEFS[
						data.type
					].label.toLowerCase()}</Button
				>
			</div>
			{#if creating}
				<form
					onsubmit={create}
					class="flex flex-col gap-2 rounded-md bg-surface p-3 shadow-e1"
					data-testid="create-form"
				>
					<label class="flex flex-col gap-1 type-small"
						>Name in English<input
							class={field}
							required
							minlength="2"
							maxlength="120"
							bind:value={draft.name_en}
						/></label
					>
					{#if data.type !== 'dish'}
						<label class="flex flex-col gap-1 type-small"
							>Taluka<select class={field} required bind:value={draft.taluka_id}
								><option value="">Pick…</option>{#each data.talukas as t (t.id)}<option value={t.id}
										>{t.name}</option
									>{/each}</select
							></label
						>
					{/if}
					{#if data.type === 'place'}
						<label class="flex flex-col gap-1 type-small"
							>Type of place<select class={field} required bind:value={draft.category}
								><option value="">Pick…</option
								>{#each Constants.public.Enums.place_category as c (c)}<option value={c}>{c}</option
									>{/each}</select
							></label
						>
					{/if}
					{#if problem}<p class="type-small text-danger" role="alert">{problem}</p>{/if}
					<Button type="submit">Create draft</Button>
				</form>
			{/if}
			<ul
				class="flex flex-col gap-1 lg:max-h-[calc(100dvh-22rem)] lg:overflow-auto"
				data-testid="entry-list"
			>
				{#each data.items as e (e.id)}
					{@const on = page.params.id === e.id}
					<li>
						<a
							href="{resolve('/admin/content/[type]/[id]', { type: e.type, id: e.id })}{search}"
							aria-current={on ? 'page' : undefined}
							class={[
								'flex flex-col gap-1 rounded-md p-3 text-text no-underline',
								on ? 'bg-lagoon-50' : 'bg-surface hover:bg-surface-2'
							]}
						>
							<span class="flex items-center gap-2">
								<span class="min-w-0 flex-1 truncate type-body-strong">{e.name}</span>
								<span class="type-small text-text-2">{e.percent}%</span>
							</span>
							<span class="flex flex-wrap gap-x-2 type-small text-text-2">
								<span>{e.code ?? 'no ID'}</span>
								<span
									>{STATUS_LABEL[e.status]}{#if e.archived_at}
										· archived{/if}</span
								>
								{#if e.taluka_id}<span>{talukaName[e.taluka_id]}</span>{/if}
								{#if e.missing}<span class="text-caution">{e.missing} missing</span>{/if}
							</span>
							{#if e.last_edited_by}<span class="type-small text-text-2"
									>Last edited by {e.last_edited_by} on {when(e.last_edited_at)}</span
								>{/if}
						</a>
					</li>
				{:else}
					<li class="type-body text-text-2">No entries match.</li>
				{/each}
			</ul>
			<nav aria-label="Other content" class="flex flex-col gap-1 border-t border-border pt-3">
				<p class="type-label text-text-2">Other content</p>
				<ul class="flex flex-wrap gap-2">
					{#each Object.entries(TABLES) as [t, label] (t)}<li>
							<a class="type-small" href={resolve('/admin/tables/[table]', { table: t })}>{label}</a
							>
						</li>{/each}
				</ul>
			</nav>
		</aside>
		<section class={[!detail && 'hidden lg:block']}>
			{@render children()}
		</section>
	</div>
</Page>
