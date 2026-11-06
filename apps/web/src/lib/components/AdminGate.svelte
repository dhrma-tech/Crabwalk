<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import { m } from '#lib/paraglide/messages.js';
	import Button from './Button.svelte';

	// TODO(before-deploy): restore full auth — temporary admin gate (docs/RESTORE_AUTH.md). Email + team passcode and
	// Continue: the server checks both (POST /auth/admin). Not on it → the visitor stays a guest.
	// Bottom sheet on phones, centred dialog on laptops.
	let { open = $bindable(false) }: { open?: boolean } = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let email = $state('');
	let passcode = $state('');
	let busy = $state(false);
	let note = $state<'denied' | 'locked' | 'failed' | null>(null);

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		note = null;
		try {
			const res = await fetch('/auth/admin', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, passcode })
			});
			if (res.status === 429) {
				note = 'locked';
				return;
			}
			const r = res.ok ? ((await res.json()) as { admin: boolean; to?: string }) : null;
			if (r?.admin && r.to) location.assign(r.to);
			else {
				note = r ? 'denied' : 'failed';
				passcode = '';
			}
		} catch {
			note = 'failed';
		} finally {
			busy = false;
		}
	}
</script>

<dialog
	bind:this={dialog}
	onclose={() => (open = false)}
	aria-labelledby="gate-title"
	class="m-0 mt-auto w-full max-w-none rounded-t-xl bg-surface p-0 text-text shadow-e3 backdrop:bg-(--scrim) sm:m-auto sm:max-w-110 sm:rounded-xl"
	data-testid="admin-gate"
>
	<form
		onsubmit={submit}
		class="flex flex-col gap-4 p-5 pb-[calc(20px+env(safe-area-inset-bottom))]"
		novalidate
	>
		<div class="flex items-start gap-2">
			<h2 id="gate-title" class="flex-1 type-h2">{m.gate_title()}</h2>
			<button
				type="button"
				class="-m-2 flex size-11 items-center justify-center rounded-full text-text-2 hover:bg-surface-2"
				aria-label={m.close()}
				onclick={() => (open = false)}><X size={22} aria-hidden="true" /></button
			>
		</div>
		<p class="type-body text-text-2">{m.gate_hint()}</p>
		<label class="flex flex-col gap-1.5">
			<span class="type-label text-text-2">{m.gate_email()}</span>
			<input
				type="email"
				name="email"
				autocomplete="email"
				inputmode="email"
				required
				maxlength="254"
				bind:value={email}
				class="min-h-12 rounded-md border border-border-strong bg-surface px-3 type-body text-text"
			/>
		</label>
		<label class="flex flex-col gap-1.5">
			<span class="type-label text-text-2">{m.gate_passcode()}</span>
			<input
				type="password"
				name="passcode"
				autocomplete="current-password"
				required
				maxlength="200"
				bind:value={passcode}
				class="min-h-12 rounded-md border border-border-strong bg-surface px-3 type-body text-text"
			/>
		</label>
		<div aria-live="polite">
			{#if note === 'denied'}
				<p class="type-body-strong text-danger" data-testid="gate-denied">{m.gate_no_access()}</p>
				<p class="type-small text-text-2">{m.gate_guest_ok()}</p>
			{:else if note === 'locked'}
				<p class="type-body-strong text-danger" data-testid="gate-locked">{m.gate_locked()}</p>
				<p class="type-small text-text-2">{m.gate_guest_ok()}</p>
			{:else if note === 'failed'}
				<p class="type-body text-danger">{m.gate_failed()}</p>
			{/if}
		</div>
		<Button type="submit" loading={busy} disabled={busy || !email.trim() || !passcode}
			>{m.gate_continue()}</Button
		>
	</form>
</dialog>
