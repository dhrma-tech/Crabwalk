<script lang="ts">
	import { beforeNavigate, goto, invalidate } from '$app/navigation';
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { DEFS, STATUS_LABEL, allFields, type EntryType } from '#lib/admin/fields.ts';
	import {
		missingRequired,
		validate,
		validateRows,
		type Rows,
		type Values
	} from '#lib/admin/validate.ts';
	import Button from '../Button.svelte';
	import FieldInput from './FieldInput.svelte';
	import RowsEditor from './RowsEditor.svelte';
	import PhotoSlots from './PhotoSlots.svelte';

	// Admin editor for one place / stay / eatery / dish (ADMIN_ACCESS_CHANGES.md). Saves only what changed, with the
	// version it was loaded at; if someone else saved in between, their changes are shown and nothing is overwritten.
	type Photo = {
		id: string;
		slot: string | null;
		sort_order: number;
		file_name: string | null;
		credit: string | null;
		licence: string | null;
		source_url: string | null;
		thumb: string;
		width: number | null;
		height: number | null;
	};
	type Entry = {
		type: EntryType;
		id: string;
		version: string | null;
		status: 'draft' | 'in_review' | 'published';
		archived_at: string | null;
		last_edited_by: string | null;
		last_edited_at: string | null;
		owner_id: string | null;
		name: string;
		code: string | null;
		taluka_id: string | null;
		values: Values;
		rows: Rows;
		photos: Photo[];
	};
	type Review = {
		id: string;
		text: string | null;
		status: string;
		created_at: string;
		photos: { id: string; hidden: boolean; thumb: string }[];
	};

	// eslint-disable-next-line svelte/no-unused-props -- the entry is copied into local state, field by field
	let {
		entry: initial,
		reviews: initialReviews,
		labels,
		broken,
		talukas,
		tides
	}: {
		entry: Entry;
		reviews: Review[];
		labels: Record<string, string>;
		broken: { id: string; problem: 'missing' | 'archived' }[];
		talukas: { id: string; name: string; prefix: string | null }[];
		tides: { id: string; name: string }[];
	} = $props();

	const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
	// Snapshots of the props: the page remounts the editor per entry ({#key}).
	let entry = $state(untrack(() => clone(initial)));
	let base = $state(untrack(() => clone(initial.values)));
	let baseRows = $state(untrack(() => clone(initial.rows)));
	let values = $state(untrack(() => clone(initial.values)));
	let rows = $state(untrack(() => clone(initial.rows)));
	let reviews = $state(untrack(() => clone(initialReviews)));
	let serverErrors = $state<Record<string, string>>({});
	let message = $state<{ kind: 'ok' | 'error'; text: string } | null>(null);
	let saving = $state(false);
	let conflict = $state<Entry | null>(null);
	let confirmReady = $state(false);
	let deleting = $state(false);
	let deleteText = $state('');

	const def = $derived(DEFS[entry.type]);
	const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
	const changed = $derived(
		allFields(entry.type)
			.filter((f) => !same(values[f.key], base[f.key]))
			.map((f) => f.key)
	);
	const changedRows = $derived(
		def.repeats.filter((r) => !same(rows[r.key], baseRows[r.key])).map((r) => r.key)
	);
	const dirty = $derived(changed.length + changedRows.length > 0);
	const prefix = $derived(talukas.find((t) => t.id === values.taluka_id)?.prefix ?? null);
	const errors = $derived({
		...validate({ type: entry.type, regionPrefix: prefix }, values),
		...validateRows(entry.type, rows),
		...serverErrors
	});
	const blocking = $derived(
		Object.keys(errors).filter(
			(k) => changed.includes(k) || changedRows.some((r) => k === r || k.startsWith(`${r}.`))
		)
	);
	const photoCounts = $derived(
		entry.photos.reduce<Record<string, number>>((m, p) => {
			if (p.slot) m[p.slot] = (m[p.slot] ?? 0) + 1;
			return m;
		}, {})
	);
	const missing = $derived(missingRequired(entry.type, values, photoCounts, rows));
	const missingKeys = $derived(new Set(missing.map((m) => m.key)));
	const total = $derived(missing.length);
	const percent = $derived.by(() => {
		const req =
			allFields(entry.type).filter(
				(f) =>
					f.required || (f.requiredIf && f.requiredIf.in.includes(String(values[f.requiredIf.key])))
			).length +
			def.slots.filter((s) => s.min > 0).length +
			def.repeats.filter((r) => r.min).length;
		return req ? Math.round(((req - total) / req) * 100) : 100;
	});
	const brokenBy = $derived(Object.fromEntries(broken.map((b) => [b.id, b.problem])));
	const when = (ts: string | null) =>
		ts
			? new Date(ts).toLocaleString('en-IN', {
					timeZone: 'Asia/Kolkata',
					dateStyle: 'medium',
					timeStyle: 'short'
				})
			: '';
	const human = (v: unknown): string =>
		v == null || (Array.isArray(v) && !v.length)
			? 'Unknown'
			: v === true
				? 'Yes'
				: v === false
					? 'No'
					: typeof v === 'object'
						? Array.isArray(v)
							? v.join(', ')
							: JSON.stringify(v)
						: String(v);
	const labelOf = (k: string) =>
		allFields(entry.type).find((f) => f.key === k)?.label ??
		def.repeats.find((r) => r.key === k)?.title ??
		k;

	function load(e: Entry) {
		entry = clone(e);
		base = clone(e.values);
		baseRows = clone(e.rows);
		values = clone(e.values);
		rows = clone(e.rows);
		serverErrors = {};
		conflict = null;
	}

	async function send(
		method: string,
		body: unknown,
		url = `/api/admin/content/${entry.type}/${entry.id}`
	) {
		const res = await fetch(url, {
			method,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}).catch(() => null);
		if (!res) return { status: 0, body: null as Record<string, unknown> | null };
		return {
			status: res.status,
			body: (await res.json().catch(() => null)) as Record<string, unknown> | null
		};
	}

	function outcome(r: { status: number; body: Record<string, unknown> | null }, ok: string) {
		if (r.status === 200 && r.body?.ok) {
			load(r.body.entry as Entry);
			message = { kind: 'ok', text: ok };
			invalidate('admin:list');
			return true;
		}
		if (r.status === 409 && r.body?.conflict) {
			conflict = r.body.conflict as Entry;
			message = null;
			return false;
		}
		if (r.status === 422) {
			serverErrors = (r.body?.errors as Record<string, string>) ?? {};
			message = {
				kind: 'error',
				text: (r.body?.message as string) ?? 'Fix the marked fields and save again.'
			};
			return false;
		}
		if (r.status === 401) {
			message = {
				kind: 'error',
				text: 'Your admin sign-in ran out. Sign in again from Me — your edits stay on this page.'
			};
			return false;
		}
		message = {
			kind: 'error',
			text:
				r.status === 0
					? 'No connection. Your edits are still here; try again.'
					: ((r.body?.message as string) ?? `Error ${r.status}`)
		};
		return false;
	}

	async function save() {
		if (!dirty || blocking.length) return;
		saving = true;
		serverErrors = {};
		const changes = Object.fromEntries(changed.map((k) => [k, values[k]]));
		const rowsOut = Object.fromEntries(changedRows.map((k) => [k, rows[k]]));
		outcome(await send('PUT', { version: entry.version, changes, rows: rowsOut }), 'Saved.');
		saving = false;
	}

	async function act(body: Record<string, unknown>, ok: string) {
		if (dirty) {
			message = { kind: 'error', text: 'Save or undo your edits first.' };
			return;
		}
		saving = true;
		outcome(await send('POST', { ...body, version: entry.version }), ok);
		saving = false;
		confirmReady = false;
	}

	async function destroy() {
		saving = true;
		const r = await send('DELETE', { confirm: deleteText });
		saving = false;
		if (r.status === 200) {
			base = values;
			baseRows = rows;
			await invalidate('admin:list');
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved route + query string
			goto(`${resolve('/admin/content')}?type=${entry.type}`);
		} else message = { kind: 'error', text: (r.body?.message as string) ?? `Error ${r.status}` };
	}

	// Conflict: someone else saved. Show their changes; the admin chooses — never a silent overwrite.
	const theirChanges = $derived(
		conflict
			? [
					...allFields(entry.type)
						.filter((f) => !same(conflict!.values[f.key], base[f.key]))
						.map((f) => ({
							key: f.key,
							theirs: conflict!.values[f.key],
							mine: changed.includes(f.key)
						})),
					...def.repeats
						.filter((r) => !same(conflict!.rows[r.key], baseRows[r.key]))
						.map((r) => ({
							key: r.key,
							theirs: `${conflict!.rows[r.key]?.length ?? 0} rows`,
							mine: changedRows.includes(r.key)
						}))
				]
			: []
	);
	function keepMine() {
		if (!conflict) return;
		const mine = Object.fromEntries(changed.map((k) => [k, values[k]]));
		const mineRows = Object.fromEntries(changedRows.map((k) => [k, rows[k]]));
		const c = conflict;
		load(c);
		values = { ...values, ...clone(mine) };
		rows = { ...rows, ...clone(mineRows) };
		message = {
			kind: 'ok',
			text: 'Their changes are loaded under yours. Check the list above, then save.'
		};
	}

	beforeNavigate((nav) => {
		if (dirty && !confirm('You have unsaved changes. Leave without saving?')) nav.cancel();
	});
	onMount(() => {
		const warn = (e: BeforeUnloadEvent) => {
			if (dirty) e.preventDefault();
		};
		addEventListener('beforeunload', warn);
		return () => removeEventListener('beforeunload', warn);
	});

	async function moderate(kind: 'review' | 'photo', id: string, hide: boolean) {
		const r = await send('POST', { kind, id, hide }, '/api/admin/content/reviews');
		if (r.status !== 200)
			return (message = { kind: 'error', text: 'Could not change that review.' });
		reviews = reviews.map((x) =>
			kind === 'review' && x.id === id
				? { ...x, status: hide ? 'rejected' : 'approved' }
				: { ...x, photos: x.photos.map((p) => (p.id === id ? { ...p, hidden: hide } : p)) }
		);
	}
	const sectionMissing = (keys: string[]) => keys.filter((k) => missingKeys.has(k)).length;
</script>

<div class="flex flex-col gap-5 pb-4" data-testid="editor">
	<header class="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-e1">
		<div class="flex flex-wrap items-center gap-2">
			<h2 class="min-w-0 flex-1 type-h2 break-words">{entry.name}</h2>
			<span class="rounded-full bg-surface-3 px-3 py-1 type-label" data-testid="status"
				>{STATUS_LABEL[entry.status]}</span
			>
			{#if entry.archived_at}<span
					class="rounded-full bg-alphonso px-3 py-1 type-label text-on-alphonso">Archived</span
				>{/if}
		</div>
		<p class="type-small text-text-2">
			{def.label}{#if entry.code}
				· {entry.code}{/if} ·
			{#if entry.last_edited_by}Last edited by {entry.last_edited_by} on {when(
					entry.last_edited_at
				)}{:else}Not edited in the admin panel yet{/if}
		</p>
		<div class="flex items-center gap-3">
			<div
				class="h-2 flex-1 overflow-hidden rounded-full bg-surface-3"
				role="progressbar"
				aria-valuenow={percent}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label="Required fields filled"
			>
				<div
					class={['h-full', percent === 100 ? 'bg-ok' : 'bg-kokum']}
					style:width="{percent}%"
				></div>
			</div>
			<span class="type-label" data-testid="percent">{percent}% complete</span>
		</div>
		{#if missing.length}
			<details>
				<summary class="cursor-pointer type-small text-caution"
					>{missing.length} required {missing.length === 1 ? 'item' : 'items'} empty</summary
				>
				<ul class="mt-1 flex flex-wrap gap-1" data-testid="missing-list">
					{#each missing as m (m.key)}<li class="rounded-full bg-surface-2 px-2 py-0.5 type-small">
							{m.label}
						</li>{/each}
				</ul>
			</details>
		{/if}

		<!-- Workflow: draft → ready for review → approved. Any admin may approve any entry, own included. -->
		<div class="flex flex-wrap gap-2 pt-1">
			{#if entry.archived_at}
				<Button
					variant="secondary"
					onclick={() => act({ action: 'restore' }, 'Restored.')}
					disabled={saving}>Restore</Button
				>
			{:else}
				{#if entry.status === 'draft'}
					<Button
						variant="secondary"
						onclick={() =>
							missing.length
								? (confirmReady = true)
								: act({ action: 'status', to: 'in_review' }, 'Marked ready for review.')}
						disabled={saving}>Mark ready for review</Button
					>
				{/if}
				{#if entry.status !== 'published'}
					<Button
						variant="secondary"
						onclick={() =>
							act({ action: 'status', to: 'published' }, 'Approved — live on the site.')}
						disabled={saving}>Approve</Button
					>
				{/if}
				{#if entry.status !== 'draft'}
					<Button
						variant="ghost"
						onclick={() => act({ action: 'status', to: 'draft' }, 'Back to draft.')}
						disabled={saving}>Back to draft</Button
					>
				{/if}
				<Button
					variant="outline"
					onclick={() => act({ action: 'archive' }, 'Archived — hidden from the public site.')}
					disabled={saving}>Archive</Button
				>
			{/if}
			<button
				type="button"
				class="ml-auto min-h-12 rounded-md border border-danger px-4 type-body-strong text-danger hover:bg-surface-2"
				onclick={() => (deleting = true)}>Delete forever</button
			>
		</div>
		{#if confirmReady}
			<div
				class="flex flex-col gap-2 rounded-md border-2 border-alphonso p-3"
				role="alertdialog"
				aria-labelledby="ready-h"
			>
				<p id="ready-h" class="flex items-center gap-2 type-body-strong">
					<TriangleAlert size={20} aria-hidden="true" />Still missing {missing.length} required {missing.length ===
					1
						? 'item'
						: 'items'}:
				</p>
				<ul class="list-disc pl-5 type-small">
					{#each missing as m (m.key)}<li>{m.label}</li>{/each}
				</ul>
				<div class="flex flex-wrap gap-2">
					<Button
						onclick={() => act({ action: 'status', to: 'in_review' }, 'Marked ready for review.')}
						>Mark ready anyway</Button
					>
					<Button variant="ghost" onclick={() => (confirmReady = false)}>Cancel</Button>
				</div>
			</div>
		{/if}
		{#if deleting}
			<div
				class="flex flex-col gap-2 rounded-md border-2 border-danger p-3"
				role="alertdialog"
				aria-labelledby="del-h"
			>
				<p id="del-h" class="type-body-strong text-danger">Delete “{entry.name}” forever?</p>
				<p class="type-small">
					Removes the entry, its photos (files too), ratings, saves, QR codes and every related row.
					This can't be undone. Archive instead if you may want it back.
				</p>
				<label class="flex flex-col gap-1 type-small"
					>Type the name (or ID) to confirm
					<input
						class="min-h-12 rounded-md border border-border-strong px-3 type-body"
						bind:value={deleteText}
						data-testid="delete-confirm"
					/>
				</label>
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						class="min-h-12 rounded-md bg-danger px-4 type-body-strong text-white disabled:opacity-50"
						disabled={saving ||
							(deleteText.trim().toLowerCase() !== entry.name.trim().toLowerCase() &&
								deleteText.trim().toLowerCase() !== (entry.code ?? '').toLowerCase())}
						onclick={destroy}>Delete forever</button
					>
					<Button variant="ghost" onclick={() => ((deleting = false), (deleteText = ''))}
						>Cancel</Button
					>
				</div>
			</div>
		{/if}
	</header>

	{#if conflict}
		<section
			class="flex flex-col gap-2 rounded-lg border-2 border-alphonso bg-surface p-4"
			role="alert"
			data-testid="conflict"
		>
			<h3 class="type-h3">
				{conflict.last_edited_by ?? 'Someone'} saved this entry on {when(conflict.last_edited_at)} while
				you were editing
			</h3>
			<p class="type-small">Their changes (nothing has been overwritten):</p>
			<ul class="flex flex-col gap-1">
				{#each theirChanges as c (c.key)}
					<li class="type-small">
						<strong>{labelOf(c.key)}</strong>: {human(c.theirs)}{#if c.mine}<span
								class="ml-1 text-danger">— you changed this too</span
							>{/if}
					</li>
				{:else}<li class="type-small">Status, archive or photos only.</li>{/each}
			</ul>
			<div class="flex flex-wrap gap-2">
				<Button onclick={keepMine}>Load theirs, keep my edits on top</Button>
				<Button variant="ghost" onclick={() => conflict && load(conflict)}>Discard my edits</Button>
			</div>
		</section>
	{/if}

	{#if entry.owner_id}<p class="type-small text-text-2">
			Claimed by its owner (owner account set by the claim flow; not editable here).
		</p>{/if}

	{#each def.sections as s (s.title)}
		{@const n = sectionMissing(s.fields.map((f) => f.key))}
		<details open class="rounded-lg bg-surface shadow-e1">
			<summary class="flex min-h-14 cursor-pointer items-center gap-2 px-4 type-h3">
				{s.title}{#if n}<span
						class="rounded-full bg-alphonso px-2 py-0.5 type-small text-on-alphonso"
						>{n} missing</span
					>{/if}
			</summary>
			<div class="grid gap-4 px-4 pb-4 md:grid-cols-2">
				{#each s.fields as f (f.key)}
					<div
						class={f.kind === 'long' ||
						f.kind === 'lines' ||
						f.kind === 'urls' ||
						f.kind === 'gps' ||
						f.kind === 'multi' ||
						f.kind === 'months'
							? 'md:col-span-2'
							: ''}
					>
						<FieldInput
							field={f}
							bind:value={values[f.key]}
							error={errors[f.key] ?? null}
							missing={missingKeys.has(f.key)}
							changed={changed.includes(f.key)}
							{talukas}
							{tides}
						/>
					</div>
				{/each}
			</div>
		</details>
	{/each}

	{#each def.repeats as r (r.key)}
		<div class="rounded-lg bg-surface p-4 shadow-e1">
			<RowsEditor repeat={r} bind:rows={rows[r.key]} {errors} {labels} broken={brokenBy} />
		</div>
	{/each}

	<div class="rounded-lg bg-surface p-4 shadow-e1">
		<PhotoSlots
			type={entry.type}
			id={entry.id}
			slots={def.slots}
			photos={entry.photos}
			onchange={(e) => {
				const fresh = e as Entry;
				entry = { ...entry, photos: fresh.photos };
			}}
		/>
	</div>

	{#if entry.type !== 'dish'}
		<section
			class="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-e1"
			aria-labelledby="rev-h"
		>
			<h2 id="rev-h" class="type-h2">Reviews</h2>
			<p class="type-small text-text-2">
				Hide abusive text or photos. Votes, verdicts and counts can't be edited.
			</p>
			{#each reviews as r (r.id)}
				<article class="flex flex-col gap-2 border-t border-border pt-2">
					<p class={['type-body', r.status === 'rejected' && 'text-text-2 line-through']}>
						{r.text ?? '(no text)'}
					</p>
					<p class="type-small text-text-2">
						{when(r.created_at)} · {r.status === 'rejected' ? 'hidden' : r.status}
					</p>
					<div class="flex flex-wrap gap-2">
						<Button
							variant="outline"
							onclick={() => moderate('review', r.id, r.status !== 'rejected')}
							>{r.status === 'rejected' ? 'Show text' : 'Hide text'}</Button
						>
					</div>
					{#if r.photos.length}
						<ul class="flex flex-wrap gap-2">
							{#each r.photos as p (p.id)}
								<li class="flex flex-col items-center gap-1">
									<img
										src={p.thumb}
										alt="Review"
										class={['size-24 rounded-sm object-cover', p.hidden && 'opacity-40']}
										loading="lazy"
									/>
									<button
										type="button"
										class="min-h-11 type-small underline"
										onclick={() => moderate('photo', p.id, !p.hidden)}
										>{p.hidden ? 'Show photo' : 'Hide photo'}</button
									>
								</li>
							{/each}
						</ul>
					{/if}
				</article>
			{:else}<p class="type-small text-text-2">No reviews yet.</p>{/each}
		</section>
	{/if}

	<!-- Sticky save: above the phone nav; at the bottom of the edit panel on laptops. -->
	<div
		class="sticky bottom-[calc(var(--nav-h)+0.5rem)] z-bar flex flex-wrap items-center gap-3 rounded-lg bg-surface p-3 shadow-e3 lg:bottom-4"
		data-testid="save-bar"
	>
		<div class="min-w-0 flex-1" aria-live="polite">
			{#if message}<p class={['type-small', message.kind === 'error' ? 'text-danger' : 'text-ok']}>
					{message.text}
				</p>{/if}
			{#if blocking.length}<p class="type-small text-danger">
					{blocking.length} field{blocking.length === 1 ? '' : 's'} to fix before saving
				</p>
			{:else if dirty}<p class="type-small text-text-2">
					{changed.length + changedRows.length} unsaved change{changed.length +
						changedRows.length ===
					1
						? ''
						: 's'}
				</p>{/if}
		</div>
		{#if dirty}<Button variant="ghost" onclick={() => load(entry)}>Undo</Button>{/if}
		<Button
			onclick={save}
			loading={saving}
			disabled={!dirty || !!blocking.length || saving || !!conflict}
			data-testid="save">Save</Button
		>
	</div>
</div>
