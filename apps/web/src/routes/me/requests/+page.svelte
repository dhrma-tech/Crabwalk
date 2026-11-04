<script lang="ts">
	import { submitting } from '#lib/forms.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import { formatDate, formatINR } from '#lib/format.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import type { PageProps } from './$types';

	// My availability requests (P12 step I, 10.2). Crabwalk never books or takes payment: once I accept, my phone
	// goes to the owner and we settle it directly.
	let { data, form }: PageProps = $props();
	const open = (s: string) => s === 'sent' || s === 'relayed';
</script>

<Page title={m.req_mine()} back>
	<div class="mx-auto flex max-w-170 flex-col gap-4">
		<p class="type-small text-text-2">{m.req_no_booking()}</p>
		{#each data.requests as r (r.id)}
			<article
				class="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-e1"
				data-testid="my-request"
			>
				<!-- eslint-disable svelte/no-navigation-without-resolve -- listing route built server-side -->
				<h2 class="type-h3">
					{#if r.href}<a href={r.href}>{r.name}</a>{:else}{r.name}{/if}
				</h2>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
				<p class="type-small text-text-2">
					{formatDate(r.check_in)}{r.check_out ? ` – ${formatDate(r.check_out)}` : ''} · {m.req_guests(
						{
							n: r.guests
						}
					)}{r.budget != null ? ` · ${m.req_budget({ budget: formatINR(r.budget) })}` : ''}
				</p>
				<p class="type-body-strong" data-testid="request-status">{msg(`req_status_${r.status}`)}</p>
				{#if r.status === 'available' && r.owner_price != null}
					<p class="type-body">{m.req_owner_price({ price: formatINR(r.owner_price) })}</p>
				{/if}
				{#if r.status === 'countered' && r.counter_price != null}
					<p class="type-body">{m.req_counter({ price: formatINR(r.counter_price) })}</p>
				{/if}
				{#if r.owner_note}<p class="type-small">“{r.owner_note}”</p>{/if}
				{#if r.status === 'available' || r.status === 'countered'}
					<form
						method="POST"
						action="?/accept"
						use:submitting
						class="flex flex-wrap items-end gap-2"
					>
						<input type="hidden" name="id" value={r.id} />
						<label class="flex flex-col gap-1.5 type-small text-text-2"
							>{m.req_phone()}
							<input
								name="phone"
								type="tel"
								inputmode="tel"
								required
								pattern={'\\+?[0-9 ]{8,16}'}
								class="field h-12 px-3 type-body text-text"
							/>
						</label>
						<Button type="submit">{m.req_accept()}</Button>
					</form>
					<p class="type-small text-text-2">{m.req_phone_hint()}</p>
					{#if form?.phone}<p class="type-small text-danger" role="alert">
							{m.req_phone_bad()}
						</p>{/if}
					<form method="POST" action="?/decline" use:submitting>
						<input type="hidden" name="id" value={r.id} />
						<Button type="submit" variant="ghost">{m.req_decline()}</Button>
					</form>
				{:else if open(r.status)}
					<p class="type-small text-text-2">{m.req_waiting()}</p>
					<form method="POST" action="?/cancel" use:submitting>
						<input type="hidden" name="id" value={r.id} />
						<Button type="submit" variant="ghost">{m.req_cancel()}</Button>
					</form>
				{:else if r.status === 'accepted'}
					<p class="type-small">{m.req_accepted_hint()}</p>
				{/if}
			</article>
		{:else}
			<p class="type-body text-text-2">{m.req_none()}</p>
		{/each}
	</div>
</Page>
