<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import { msg } from '#lib/msg.ts';
	import { formatDate } from '#lib/format.ts';
	import type { PageProps } from './$types';

	// Me (FRONTEND §7.14). Trips from P7; offline packs (P9) and consents arrive later.
	let { data, form }: PageProps = $props();
	const sel = 'h-12 rounded-input border border-border bg-surface px-3 type-body text-text';
	const themes = [
		{ value: 'system', label: m.theme_system },
		{ value: 'light', label: m.theme_light },
		{ value: 'dark', label: m.theme_dark }
	] as const;
</script>

<Page title={m.nav_me()}>
	<div class="mx-auto flex max-w-[680px] flex-col gap-6">
		<section class="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
			{#if data.email}
				<p class="type-body">{m.me_signed_in_as({ email: data.email })}</p>
				<form method="POST" action="/login?/signOut">
					<Button variant="secondary" type="submit">{m.sign_out()}</Button>
				</form>
			{:else}
				<p class="type-body">{m.me_guest()}</p>
				<div><Button href={resolve('/login')}>{m.sign_in()}</Button></div>
			{/if}
		</section>

		{#if data.email}
			<section class="flex flex-col gap-3" data-testid="my-trips">
				<h2 class="type-h2">{m.me_trips()}</h2>
				{#if data.trips.length}
					<ul
						class="flex flex-col divide-y divide-border rounded-card border border-border bg-surface"
					>
						{#each data.trips as t (t.id)}
							<li>
								<a
									href={resolve('/plan/[id]', { id: t.id })}
									class="flex flex-col px-4 py-3 text-text no-underline"
									><span class="type-h3">{t.title}</span><span class="type-small text-text-2"
										>{m.plan_n_days({ n: t.days })}{t.start_date
											? ` · ${formatDate(t.start_date)}`
											: ''}</span
									></a
								>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="type-body text-text-2">{m.me_no_trips()}</p>
				{/if}
				<div><Button href={resolve('/plan/new')} variant="secondary">{m.plan_new()}</Button></div>
			</section>
		{/if}

		{#if data.email}
			<form
				method="POST"
				action="?/prefs"
				class="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
				data-testid="prefs"
			>
				<h2 class="type-h2">{m.me_prefs()}</h2>
				<p class="type-small text-text-2">{m.me_prefs_hint()}</p>
				<label class="flex flex-col gap-1 type-small text-text-2"
					>{m.plan_diet()}
					<select name="diet" class={sel}>
						<option value="">{m.filter_any()}</option>
						<option value="veg" selected={data.prefs.diet === 'veg'}>{m.diet_veg()}</option>
						<option value="non_veg" selected={data.prefs.diet === 'non_veg'}
							>{m.diet_nonveg()}</option
						>
						<option value="jain" selected={data.prefs.diet === 'jain'}>{m.diet_jain()}</option>
					</select>
				</label>
				<label class="flex flex-col gap-1 type-small text-text-2"
					>{m.plan_budget()}
					<select name="budget_level" class={sel}>
						<option value="">{m.filter_any()}</option>
						{#each ['budget', 'mid', 'premium'] as b (b)}<option
								value={b}
								selected={data.prefs.budget_level === b}>{msg(`budget_level_${b}`)}</option
							>{/each}
					</select>
				</label>
				<label class="flex flex-col gap-1 type-small text-text-2"
					>{m.plan_group()}
					<select name="group_type" class={sel}>
						<option value="">{m.filter_any()}</option>
						{#each ['family', 'couple', 'friends', 'solo'] as g (g)}<option
								value={g}
								selected={data.prefs.group_type === g}>{msg(`group_${g}`)}</option
							>{/each}
					</select>
				</label>
				{#if form?.prefsSaved}<p class="type-small" role="status">{m.owner_saved()}</p>{/if}
				<div><Button type="submit" variant="secondary">{m.plan_save()}</Button></div>
			</form>
		{/if}

		{#if data.isStaff || data.isOwner}
			<nav class="flex flex-col gap-2">
				{#if data.isStaff}<a
						href={resolve('/admin')}
						class="flex min-h-12 items-center rounded-card border border-border bg-surface px-4 type-h3 text-text no-underline"
						>{m.me_staff()}</a
					>{/if}
				{#if data.isOwner}<a
						href={resolve('/owner')}
						class="flex min-h-12 items-center rounded-card border border-border bg-surface px-4 type-h3 text-text no-underline"
						>{m.me_owner()}</a
					>{/if}
			</nav>
		{/if}

		<p><a href={resolve('/privacy')} class="type-body">{m.privacy_title()}</a></p>

		<section class="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
			<h2 class="type-h2">{m.theme()}</h2>
			<form method="POST" action="/prefs" class="flex flex-wrap gap-2" data-clip-check>
				<input type="hidden" name="return" value="/me" />
				{#each themes as t (t.value)}
					<button
						name="theme"
						value={t.value}
						aria-pressed={data.theme === t.value}
						class={[
							'min-h-11 rounded-chip border px-4 type-small',
							data.theme === t.value
								? 'border-sea-500 bg-sea-500 text-white'
								: 'border-border bg-surface text-text'
						]}
					>
						{t.label()}
					</button>
				{/each}
			</form>
		</section>
	</div>
</Page>
