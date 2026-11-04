<script lang="ts">
	import { submitting } from '#lib/forms.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import { formatDate, formatINR } from '#lib/format.ts';
	import Button from './Button.svelte';

	// One availability request for an owner or our team (P12 step I, 10.2): the traveller's dates, guests and
	// budget; a one-tap answer — available at a price, a single counter offer, or not available. The traveller's
	// phone shows only after they accept. No booking or payment on Crabwalk.
	type R = {
		id: string;
		name: string;
		check_in: string;
		check_out: string | null;
		guests: number;
		budget: number | null;
		note: string | null;
		status: string;
		counter_price: number | null;
		contact_phone: string | null;
	};
	let { r, relay = null }: { r: R; relay?: string | null } = $props();
	const answerable = $derived(
		['sent', 'relayed'].includes(r.status) || (r.status === 'available' && r.counter_price == null)
	);
	const field = 'field h-11 px-3 type-body text-text';
</script>

<article
	class="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-e1"
	data-testid="incoming-request"
	data-id={r.id}
>
	<h2 class="type-h3">{r.name}</h2>
	<p class="type-small text-text-2">
		{formatDate(r.check_in)}{r.check_out ? ` – ${formatDate(r.check_out)}` : ''} · {m.req_guests({
			n: r.guests
		})}{r.budget != null ? ` · ${m.req_budget({ budget: formatINR(r.budget) })}` : ''}
	</p>
	{#if r.note}<p class="type-small">“{r.note}”</p>{/if}
	<p class="type-body-strong" data-testid="request-status">{msg(`req_status_${r.status}`)}</p>
	{#if r.contact_phone}
		<p class="type-body" data-testid="request-phone">{m.req_contact({ phone: r.contact_phone })}</p>
	{/if}
	{#if relay && r.status === 'sent'}
		<div class="flex flex-wrap items-center gap-2">
			<!-- eslint-disable svelte/no-navigation-without-resolve -- WhatsApp deep link (manual relay, no paid API) -->
			<a
				href={relay}
				target="_blank"
				rel="noopener"
				class="type-body-strong"
				data-testid="relay-link">{m.req_relay()}</a
			>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
			<form method="POST" action="?/reply" use:submitting>
				<input type="hidden" name="id" value={r.id} />
				<input type="hidden" name="answer" value="relayed" />
				<Button type="submit" variant="ghost">{m.req_mark_relayed()}</Button>
			</form>
		</div>
	{/if}
	{#if answerable}
		<form method="POST" action="?/reply" use:submitting class="flex flex-col gap-2">
			<input type="hidden" name="id" value={r.id} />
			<fieldset class="flex flex-wrap gap-3">
				<legend class="sr-only">{m.req_answer()}</legend>
				{#each ['available', 'countered', 'unavailable'] as a (a)}
					<label class="flex min-h-11 items-center gap-2 type-body">
						<input type="radio" name="answer" value={a} required class="size-5 accent-kokum" />{msg(
							`req_answer_${a}`
						)}
					</label>
				{/each}
			</fieldset>
			<div class="flex flex-wrap gap-2">
				<input
					name="price"
					type="number"
					min="0"
					inputmode="numeric"
					aria-label={m.req_price()}
					placeholder={m.req_price()}
					class={field}
				/>
				<input
					name="note"
					maxlength="300"
					aria-label={m.req_note()}
					placeholder={m.req_note()}
					class={[field, 'min-w-0 flex-1']}
				/>
			</div>
			<div><Button type="submit">{m.req_send_answer()}</Button></div>
		</form>
	{/if}
</article>
