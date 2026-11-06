<script lang="ts">
	import { beforeNavigate, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import type { PageProps } from './$types';

	// Generic editor for the other content tables: every column from the schema, by type. Unknown = empty = null.
	let { data }: PageProps = $props();
	type Row = Record<string, unknown>;
	let selected = $state<Row | null>(null);
	let creating = $state(false);
	let form = $state<Record<string, string>>({});
	let start = $state('{}');
	let errors = $state<Record<string, string>>({});
	let message = $state<{ kind: 'ok' | 'error'; text: string } | null>(null);
	let conflict = $state<Row | null>(null);
	let confirmDelete = $state('');
	const dirty = $derived(JSON.stringify(form) !== start);
	const editable = $derived(data.cols.filter((c) => !c.readOnly));
	const titleOf = (r: Row) =>
		String(
			r.name_en ?? r.code ?? r.question ?? r.title ?? r.reason_en ?? r.text ?? r.type ?? r.id
		).slice(0, 80);

	const show = (c: (typeof data.cols)[number], v: unknown) =>
		v == null
			? ''
			: c.udt_name === 'jsonb' || c.udt_name === 'json'
				? JSON.stringify(v, null, 2)
				: c.udt_name === '_text' && Array.isArray(v)
					? v.join('\n')
					: c.udt_name === 'timestamptz'
						? new Date(String(v)).toISOString().slice(0, 16)
						: String(v);
	function pick(r: Row | null) {
		if (dirty && !confirm('Discard unsaved changes?')) return;
		selected = r;
		creating = !r;
		form = Object.fromEntries(
			editable.map((c) => [c.column_name, r ? show(c, r[c.column_name]) : ''])
		);
		start = JSON.stringify(form);
		errors = {};
		message = null;
		conflict = null;
		confirmDelete = '';
	}
	function back() {
		if (dirty && !confirm('Discard unsaved changes?')) return;
		selected = null;
		creating = false;
		start = JSON.stringify(form);
	}
	beforeNavigate((nav) => {
		if (dirty && !confirm('You have unsaved changes. Leave without saving?')) nav.cancel();
	});

	async function save() {
		const values = Object.fromEntries(
			editable.map((c) => [
				c.column_name,
				c.udt_name === 'timestamptz' && form[c.column_name]
					? new Date(form[c.column_name]!).toISOString()
					: form[c.column_name]
			])
		);
		const res = await fetch(
			creating
				? `/api/admin/tables/${data.table}`
				: `/api/admin/tables/${data.table}/${selected!.id}`,
			{
				method: creating ? 'POST' : 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(
					creating ? { values } : { version: selected!.updated_at ?? null, values }
				)
			}
		).catch(() => null);
		const body = (await res?.json().catch(() => null)) as {
			conflict?: Row;
			errors?: Record<string, string>;
			message?: string;
			id?: string;
			row?: Row;
		} | null;
		if (res?.status === 409) {
			conflict = body?.conflict ?? null;
			return;
		}
		if (!res?.ok) {
			errors = body?.errors ?? {};
			message = { kind: 'error', text: body?.message ?? 'Fix the marked fields.' };
			return;
		}
		start = JSON.stringify(form);
		message = { kind: 'ok', text: 'Saved.' };
		await invalidateAll();
		const fresh = creating ? data.rows.find((r) => r.id === body?.id) : body?.row;
		creating = false;
		selected = fresh ?? null;
	}
	async function remove() {
		const res = await fetch(`/api/admin/tables/${data.table}/${selected!.id}`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ confirm: confirmDelete })
		}).catch(() => null);
		if (!res?.ok) return (message = { kind: 'error', text: 'Not deleted.' });
		start = JSON.stringify(form);
		selected = null;
		await invalidateAll();
	}
	const field =
		'min-h-11 w-full rounded-md border border-border-strong bg-surface px-2 type-body text-text';
</script>

<Page title={data.label} back tool>
	<div class="lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-6">
		<aside class={['flex flex-col gap-2', (selected || creating) && 'hidden lg:flex']}>
			<a href={resolve('/admin/content')} class="type-label">← Listings editor</a>
			<Button variant="secondary" onclick={() => pick(null)}>New row</Button>
			<ul class="flex flex-col gap-1 lg:max-h-[calc(100dvh-16rem)] lg:overflow-auto">
				{#each data.rows as r (r.id)}
					<li>
						<button
							type="button"
							class={[
								'w-full rounded-md p-3 text-left',
								selected?.id === r.id ? 'bg-lagoon-50' : 'bg-surface hover:bg-surface-2'
							]}
							onclick={() => pick(r)}
						>
							<span class="block truncate type-body-strong">{titleOf(r)}</span>
							{#if r.status}<span class="type-small text-text-2">{r.status}</span>{/if}
						</button>
					</li>
				{:else}<li class="type-body text-text-2">No rows.</li>{/each}
			</ul>
		</aside>
		{#if selected || creating}
			<section class="flex flex-col gap-3">
				<button type="button" class="min-h-11 self-start type-label lg:hidden" onclick={back}
					>← All rows</button
				>
				{#if conflict}
					<div class="rounded-md border-2 border-alphonso p-3" role="alert">
						<p class="type-body-strong">
							Someone saved this row while you were editing. Nothing was overwritten.
						</p>
						<pre class="max-h-60 overflow-auto type-small">{JSON.stringify(conflict, null, 2)}</pre>
						<Button
							variant="secondary"
							onclick={() => {
								const c = conflict!;
								conflict = null;
								start = '{}';
								pick(c);
							}}>Load their version</Button
						>
					</div>
				{/if}
				<div class="grid gap-3 rounded-lg bg-surface p-4 shadow-e1 md:grid-cols-2">
					{#each data.cols as c (c.column_name)}
						{@const k = c.column_name}
						<label
							class={[
								'flex flex-col gap-1 type-label',
								(c.udt_name === 'jsonb' || c.udt_name === 'text') && 'md:col-span-2'
							]}
						>
							<span
								>{k.replace(/_/g, ' ')}{#if !c.nullable && !c.has_default && !c.readOnly}<span
										class="text-danger"
									>
										*</span
									>{/if}</span
							>
							{#if c.readOnly}
								<span class="type-small text-text-2"
									>{selected ? String(selected[k] ?? '—') : 'set automatically'}</span
								>
							{:else if c.enum_values}
								<select class={field} bind:value={form[k]}
									><option value="">Unknown</option>{#each c.enum_values as o (o)}<option value={o}
											>{o}</option
										>{/each}</select
								>
							{:else if c.udt_name === 'bool'}
								<select class={field} bind:value={form[k]}
									><option value="">Unknown</option><option value="true">Yes</option><option
										value="false">No</option
									></select
								>
							{:else if c.udt_name === 'jsonb' || c.udt_name === '_text' || c.udt_name === 'text'}
								<textarea
									class={[field, 'min-h-20 py-2']}
									rows={c.udt_name === 'jsonb' ? 5 : 2}
									bind:value={form[k]}></textarea>
							{:else}
								<input
									class={field}
									type={c.udt_name === 'date'
										? 'date'
										: c.udt_name === 'timestamptz'
											? 'datetime-local'
											: c.udt_name.startsWith('int') ||
												  c.udt_name.startsWith('float') ||
												  c.udt_name === 'numeric'
												? 'number'
												: 'text'}
									step="any"
									bind:value={form[k]}
								/>
							{/if}
							{#if errors[k]}<span class="type-small text-danger" role="alert">{errors[k]}</span
								>{/if}
						</label>
					{/each}
				</div>
				{#if message}<p
						class={['type-small', message.kind === 'error' ? 'text-danger' : 'text-ok']}
						role="status"
					>
						{message.text}
					</p>{/if}
				<div
					class="sticky bottom-[calc(var(--nav-h)+0.5rem)] flex flex-wrap gap-2 rounded-lg bg-surface p-3 shadow-e3 lg:bottom-4"
				>
					<Button onclick={save} disabled={!dirty}>{creating ? 'Create' : 'Save'}</Button>
					{#if data.archivable && selected}
						<Button
							variant="outline"
							onclick={() => {
								form.status = form.status === 'draft' ? 'published' : 'draft';
							}}>{form.status === 'draft' ? 'Restore (publish)' : 'Archive (hide)'}</Button
						>
					{/if}
					{#if selected}
						<input
							class={[field, 'max-w-40']}
							placeholder="type delete"
							aria-label="Type delete to confirm"
							bind:value={confirmDelete}
						/>
						<button
							type="button"
							class="min-h-11 rounded-md border border-danger px-3 type-label text-danger disabled:opacity-40"
							disabled={confirmDelete.trim().toLowerCase() !== 'delete'}
							onclick={remove}>Delete forever</button
						>
					{/if}
				</div>
			</section>
		{/if}
	</div>
</Page>
