<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { loginHref } from '#lib/login.ts';
	import Button from './Button.svelte';

	// "Is it free?" (P12 step I, product plan 10.2): an availability request to the owner — or, for listings not
	// claimed yet, to our team, who relay it. No booking and no payment; my phone goes to the owner only if I accept.
	let { type, slug, signedIn }: { type: 'stay' | 'eatery'; slug: string; signedIn: boolean } =
		$props();
	let open = $state(false);
	let busy = $state(false);
	let sent = $state(false);
	let failed = $state(false);
	const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		const f = new FormData(e.currentTarget as HTMLFormElement);
		busy = true;
		failed = false;
		const r = await fetch('/api/requests', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				type,
				slug,
				check_in: f.get('check_in'),
				check_out: f.get('check_out') || null,
				guests: Number(f.get('guests')),
				budget: f.get('budget') ? Number(f.get('budget')) : null,
				note: f.get('note') ?? ''
			})
		}).catch(() => null);
		busy = false;
		if (r?.ok) sent = true;
		else failed = true;
	}
	const field = 'field h-12 w-full px-3 type-body text-text';
	const label = 'flex flex-col gap-1.5 type-small text-text-2';
</script>

<section
	class="flex flex-col gap-3 rounded-lg bg-surface-2 p-4 print:hidden"
	data-testid="request-form"
>
	<h2 class="type-h3">{type === 'stay' ? m.req_ask_stay() : m.req_ask_eatery()}</h2>
	<p class="type-small text-text-2">{m.req_no_booking()}</p>
	{#if sent}
		<p class="type-body" role="status">
			{m.req_sent()} <a href={resolve('/me/requests')}>{m.req_mine()}</a>
		</p>
	{:else if !signedIn}
		<div><Button variant="secondary" href={loginHref(page.url)}>{m.sign_in()}</Button></div>
	{:else if !open}
		<div><Button variant="secondary" onclick={() => (open = true)}>{m.req_open()}</Button></div>
	{:else}
		<form class="grid gap-3 sm:grid-cols-2" onsubmit={submit}>
			<label class={label}
				>{type === 'stay' ? m.req_check_in() : m.req_date()}
				<input name="check_in" type="date" min={today} required class={field} />
			</label>
			{#if type === 'stay'}
				<label class={label}
					>{m.req_check_out()}
					<input name="check_out" type="date" min={today} required class={field} />
				</label>
			{/if}
			<label class={label}
				>{m.req_guests_label()}
				<input name="guests" type="number" min="1" max="50" value="2" required class={field} />
			</label>
			<label class={label}
				>{type === 'stay' ? m.req_budget_night() : m.req_budget_meal()}
				<input name="budget" type="number" min="0" inputmode="numeric" class={field} />
			</label>
			<label class={['sm:col-span-2', label]}
				>{m.req_note()}
				<input name="note" maxlength="300" class={field} />
			</label>
			<div class="sm:col-span-2">
				<Button type="submit" loading={busy}>{m.req_send()}</Button>
				{#if failed}<p class="mt-2 type-small text-danger" role="alert">{m.send_failed()}</p>{/if}
			</div>
		</form>
	{/if}
</section>
