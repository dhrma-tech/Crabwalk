<script lang="ts">
	import { submitting } from '#lib/forms.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import { formatDate } from '#lib/format.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const field = 'h-11 w-full border-b border-text bg-bg type-body text-text';
	type Ev = {
		id: string;
		name_en: string;
		name_hi: string | null;
		name_mr: string | null;
		type: string;
		from_date: string;
		to_date: string;
		taluka_id: string | null;
		impact: unknown;
	};
	const blank: Ev = {
		id: '',
		name_en: '',
		name_hi: '',
		name_mr: '',
		type: 'festival',
		from_date: '',
		to_date: '',
		taluka_id: '',
		impact: {}
	};
	const impact = (e: Ev) => (e.impact ?? {}) as { crowd?: string; closures?: string };
</script>

{#snippet editor(e: Ev)}
	<form method="POST" action="?/save" use:submitting class="grid gap-3 sm:grid-cols-2">
		<input type="hidden" name="id" value={e.id} />
		<label class="flex flex-col gap-1 type-small text-text-2"
			>{m.event_name()} (EN)<input name="name_en" value={e.name_en} required class={field} /></label
		>
		<label class="flex flex-col gap-1 type-small text-text-2"
			>{m.event_name()} (MR)<input name="name_mr" value={e.name_mr ?? ''} class={field} /></label
		>
		<label class="flex flex-col gap-1 type-small text-text-2"
			>{m.event_name()} (HI)<input name="name_hi" value={e.name_hi ?? ''} class={field} /></label
		>
		<label class="flex flex-col gap-1 type-small text-text-2"
			>{m.event_type()}
			<select name="type" class={field}>
				{#each ['festival', 'jatra', 'season'] as t (t)}<option value={t} selected={e.type === t}
						>{msg(`event_type_${t}`)}</option
					>{/each}
			</select>
		</label>
		<label class="flex flex-col gap-1 type-small text-text-2"
			>{m.event_from()}<input
				type="date"
				name="from_date"
				value={e.from_date}
				required
				class={field}
			/></label
		>
		<label class="flex flex-col gap-1 type-small text-text-2"
			>{m.event_to()}<input
				type="date"
				name="to_date"
				value={e.to_date}
				required
				class={field}
			/></label
		>
		<label class="flex flex-col gap-1 type-small text-text-2"
			>{m.event_taluka()}
			<select name="taluka_id" class={field}>
				<option value="">{m.event_all_talukas()}</option>
				{#each data.talukas as t (t.id)}<option value={t.id} selected={e.taluka_id === t.id}
						>{t.name_en}</option
					>{/each}
			</select>
		</label>
		<label class="flex flex-col gap-1 type-small text-text-2"
			>{m.event_crowd()}
			<select name="crowd" class={field}>
				<option value="">{m.filter_any()}</option>
				<option value="busy" selected={impact(e).crowd === 'busy'}>{m.crowd_busy()}</option>
				<option value="calm" selected={impact(e).crowd === 'calm'}>{m.crowd_calm()}</option>
			</select>
		</label>
		<label class="flex flex-col gap-1 type-small text-text-2 sm:col-span-2"
			>{m.event_closures()}<input
				name="closures"
				value={impact(e).closures ?? ''}
				class={field}
			/></label
		>
		<div class="sm:col-span-2">
			<Button type="submit" variant="secondary">{m.qr_admin_save()}</Button>
		</div>
	</form>
{/snippet}

<Page title={m.events_title()} back>
	<div class="mx-auto flex max-w-[680px] flex-col gap-6">
		<section class="flex flex-col gap-3 border border-border bg-surface p-4">
			<h2 class="type-h2">{m.event_add()}</h2>
			{@render editor(blank)}
			{#if form?.saved}<p class="type-small" role="status">{m.owner_saved()}</p>{/if}
			{#if form?.error}<p class="type-small" role="alert">{m.send_failed()}</p>{/if}
		</section>
		<ul class="flex flex-col gap-3">
			{#each data.events as e (e.id)}
				<li class="border border-border bg-surface p-4">
					<details>
						<summary class="flex min-h-11 cursor-pointer flex-wrap items-center gap-2">
							<span class="type-h3">{e.name_en}</span>
							<span class="type-small text-text-2"
								>{msg(`event_type_${e.type}`)} · {formatDate(e.from_date)} – {formatDate(
									e.to_date
								)}</span
							>
						</summary>
						<div class="mt-3 flex flex-col gap-3">
							{@render editor(e)}
							<form method="POST" action="?/delete" use:submitting>
								<input type="hidden" name="id" value={e.id} />
								<Button type="submit" variant="ghost">{m.plan_remove()}</Button>
							</form>
						</div>
					</details>
				</li>
			{/each}
		</ul>
	</div>
</Page>
