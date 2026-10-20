<script lang="ts">
	import Flag from '@lucide/svelte/icons/flag';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import Button from '../Button.svelte';

	// "Report a problem" → reports (anon insert, RLS) → verifier triage + immediate re-check (DECISIONS P4-3).
	let { entityType, entityId }: { entityType: 'place' | 'stay' | 'eatery'; entityId: string } =
		$props();
	let open = $state(false);
	let status = $state<'idle' | 'sending' | 'sent' | 'error'>('idle');
	let type = $state('wrong_info');
	let text = $state('');
	let website = $state(''); // honeypot

	async function send(e: SubmitEvent) {
		e.preventDefault();
		status = 'sending';
		const res = await fetch('/api/reports', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ entity_type: entityType, entity_id: entityId, type, text, website })
		}).catch(() => null);
		status = res?.ok ? 'sent' : 'error';
	}
</script>

{#if status === 'sent'}
	<p class="type-small text-text-2" role="status">{m.report_sent()}</p>
{:else if !open}
	<Button variant="ghost" onclick={() => (open = true)}>
		{#snippet icon()}<Flag size={20} aria-hidden="true" />{/snippet}
		{m.report_problem()}
	</Button>
{:else}
	<form onsubmit={send} class="flex flex-col gap-3 border-t border-border pt-3" data-clip-check>
		<fieldset class="flex flex-wrap gap-2">
			<legend class="mb-2 type-h3">{m.report_problem()}</legend>
			{#each ['wrong_info', 'unsafe_spot', 'garbage'] as t (t)}
				<label
					class="flex min-h-11 items-center gap-2 border border-text px-3 type-small has-checked:bg-text has-checked:text-bg"
				>
					<input type="radio" name="type" value={t} bind:group={type} />{msg(`report_type_${t}`)}
				</label>
			{/each}
		</fieldset>
		<label class="flex flex-col gap-1.5 type-small text-text-2">
			{m.report_details()}
			<textarea
				bind:value={text}
				maxlength="1000"
				rows="3"
				class="border border-text bg-transparent p-3 type-body text-text"></textarea>
		</label>
		<input
			type="text"
			name="website"
			bind:value={website}
			tabindex="-1"
			autocomplete="off"
			class="hidden"
			aria-hidden="true"
		/>
		{#if status === 'error'}<p class="type-small" role="alert">{m.send_failed()}</p>{/if}
		<div>
			<Button type="submit" variant="secondary" loading={status === 'sending'}
				>{m.report_send()}</Button
			>
		</div>
	</form>
{/if}
