<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const field = 'min-h-11 w-full border-b border-text bg-bg type-body text-text';
</script>

<Page title={m.qr_admin_title()} back>
	<div class="mx-auto flex max-w-[680px] flex-col gap-6">
		<nav class="flex flex-wrap items-center gap-2" aria-label={m.qr_admin_type()}>
			<span class="type-small text-text-2">{m.qr_admin_type()}</span>
			{#each data.types as t (t)}
				<a
					href="{resolve('/admin/qr')}?type={t}"
					aria-current={t === data.type ? 'page' : undefined}
					class={[
						'flex min-h-11 items-center border border-border px-4 type-small no-underline',
						t === data.type ? 'bg-text text-bg' : 'bg-raised text-text'
					]}>{msg(`qr_type_${t}`)}</a
				>
			{/each}
		</nav>

		<form
			method="POST"
			action="?/create"
			use:enhance
			class="flex flex-col gap-3 border border-border bg-surface p-4"
		>
			<input type="hidden" name="type" value={data.type} />
			<label class="flex flex-col gap-1.5 type-small text-text-2">
				{m.qr_admin_entity()}
				<select name="id" required class={field}>
					{#each data.options as o (o.id)}<option value={o.id}>{o.name}</option>{/each}
				</select>
			</label>
			{#if form?.created}<p class="type-small" role="status">{form.created}</p>{/if}
			{#if form?.error === 'create'}<p class="type-small" role="alert">{m.send_failed()}</p>{/if}
			<div><Button type="submit">{m.qr_admin_create()}</Button></div>
		</form>

		{#if data.codes.length}
			<ul class="flex flex-col gap-3">
				{#each data.codes as c (c.code)}
					<li class="flex flex-col gap-3 border border-border bg-surface p-4">
						<div class="flex flex-wrap items-baseline justify-between gap-2">
							<a href={resolve('/q/[code]', { code: c.code })} class="type-h3">{c.code}</a>
							<span class="type-small text-text-2"
								>{msg(`qr_type_${c.entity_type}`)} · {c.target}</span
							>
						</div>
						<form method="POST" action="?/save" use:enhance class="grid gap-3 sm:grid-cols-2">
							<input type="hidden" name="code" value={c.code} />
							<label class="flex flex-col gap-1.5 type-small text-text-2">
								{m.qr_admin_permission()}
								<select name="permission_status" class={field}>
									<option value="pending" selected={c.permission_status === 'pending'}
										>{m.qr_perm_pending()}</option
									>
									<option value="granted" selected={c.permission_status === 'granted'}
										>{m.qr_perm_granted()}</option
									>
								</select>
							</label>
							<label class="flex flex-col gap-1.5 type-small text-text-2">
								{m.qr_admin_permission_body()}
								<input name="permission_body" value={c.permission_body ?? ''} class={field} />
							</label>
							<label class="flex flex-col gap-1.5 type-small text-text-2">
								{m.qr_admin_installed()}
								<input
									type="date"
									name="installed_at"
									value={c.installed_at?.slice(0, 10) ?? ''}
									class={field}
								/>
							</label>
							<label class="flex flex-col gap-1.5 type-small text-text-2">
								{m.qr_admin_sponsor()}
								<input name="sponsor" value={c.sponsor} class={field} />
							</label>
							<div class="flex flex-wrap items-center gap-3 sm:col-span-2">
								<Button type="submit" variant="secondary">{m.qr_admin_save()}</Button>
								<a
									href={resolve('/admin/qr/[code]/plaque', { code: c.code })}
									class="type-body"
									target="_blank">{m.qr_admin_plaque()}</a
								>
								{#if form?.saved === c.code}<span class="type-small" role="status"
										>{m.owner_saved()}</span
									>{/if}
							</div>
						</form>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="type-body text-text-2">{m.qr_admin_none()}</p>
		{/if}
	</div>
</Page>
