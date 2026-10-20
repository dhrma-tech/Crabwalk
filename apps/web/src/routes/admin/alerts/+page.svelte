<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { msg } from '#lib/msg.ts';
	import { relTime } from '#lib/format.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let lon = $state('');
	let lat = $state('');
	const field = 'h-11 w-full rounded-input border border-border bg-raised px-3 type-body text-text';
	function gps() {
		navigator.geolocation?.getCurrentPosition(
			(p) => {
				lon = p.coords.longitude.toFixed(5);
				lat = p.coords.latitude.toFixed(5);
			},
			() => {},
			{ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
		);
	}
</script>

<Page title={m.alerts_title()} back>
	<div class="mx-auto flex max-w-[680px] flex-col gap-6">
		<form
			method="POST"
			action="?/create"
			use:enhance
			class="grid gap-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-2"
		>
			<h2 class="type-h2 sm:col-span-2">{m.alerts_add()}</h2>
			<label class="flex flex-col gap-1 type-small text-text-2"
				>{m.event_type()}<select name="type" class={field}
					>{#each data.types as t (t)}<option value={t}>{msg(`alert_${t}`)}</option>{/each}</select
				></label
			>
			<label class="flex flex-col gap-1 type-small text-text-2"
				>{m.alerts_severity()}<select name="severity" class={field}
					><option value="caution">{m.severity_caution()}</option><option value="danger"
						>{m.severity_danger()}</option
					></select
				></label
			>
			<label class="flex flex-col gap-1 type-small text-text-2 sm:col-span-2"
				>{m.alerts_reason()} (EN)<input
					name="reason_en"
					required
					minlength="3"
					maxlength="300"
					class={field}
				/></label
			>
			<label class="flex flex-col gap-1 type-small text-text-2"
				>{m.alerts_reason()} (MR)<input name="reason_mr" maxlength="300" class={field} /></label
			>
			<label class="flex flex-col gap-1 type-small text-text-2"
				>{m.alerts_reason()} (HI)<input name="reason_hi" maxlength="300" class={field} /></label
			>
			<label class="flex flex-col gap-1 type-small text-text-2"
				>{m.field_lat()}<input
					name="lat"
					bind:value={lat}
					required
					inputmode="decimal"
					class={field}
				/></label
			>
			<label class="flex flex-col gap-1 type-small text-text-2"
				>{m.field_lon()}<input
					name="lon"
					bind:value={lon}
					required
					inputmode="decimal"
					class={field}
				/></label
			>
			<div class="flex flex-wrap gap-2 sm:col-span-2">
				<Button type="button" variant="ghost" onclick={gps}>{m.plan_use_location()}</Button>
				<Button type="submit">{m.alerts_add()}</Button>
			</div>
			{#if form?.created}<p class="type-small" role="status">{m.owner_saved()}</p>{/if}
			{#if form?.error}<p class="type-small" role="alert">{m.send_failed()}</p>{/if}
		</form>

		<ul class="flex flex-col gap-3">
			{#each data.alerts as a (a.id)}
				<li
					class="flex flex-col gap-2 rounded-card border border-border bg-surface p-4"
					data-testid="alert-row"
				>
					<p class="type-h3">
						{msg(`alert_${a.type}`)} ·
						<span class={a.severity === 'danger' ? 'text-danger' : 'text-caution'}
							>{msg(`severity_${a.severity}`)}</span
						>
					</p>
					{#if a.reason_en}<p class="type-body">{a.reason_en}</p>{/if}
					<p class="type-small text-text-2">
						{m.alert_times({
							ago: relTime(a.reported_at, getLocale()),
							left: relTime(a.expires_at, getLocale())
						})}
					</p>
					<div class="flex flex-wrap gap-2">
						<form method="POST" action="?/confirm" use:enhance>
							<input type="hidden" name="id" value={a.id} />
							<Button type="submit" variant="secondary">{m.alerts_confirm()}</Button>
						</form>
						<form method="POST" action="?/remove" use:enhance>
							<input type="hidden" name="id" value={a.id} />
							<Button type="submit" variant="ghost">{m.alerts_remove()}</Button>
						</form>
					</div>
				</li>
			{/each}
		</ul>
		{#if !data.alerts.length}<p class="type-body text-text-2">{m.alerts_none()}</p>{/if}
	</div>
</Page>
