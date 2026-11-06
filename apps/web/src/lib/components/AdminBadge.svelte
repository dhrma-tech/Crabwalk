<script lang="ts">
	import LogOut from '@lucide/svelte/icons/log-out';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';

	// TODO(before-deploy): restore full auth — temp gate header indicator: "Admin" (to the admin panel) + Exit admin.
	// Shown only while the server says the signed admin cookie is valid (root layout data).
	let { compact = false }: { compact?: boolean } = $props();
	const admin = $derived((page.data as { gate?: { admin: string | null } }).gate?.admin ?? null);

	async function exit() {
		await fetch('/auth/admin', { method: 'DELETE' }).catch(() => null);
		location.assign('/');
	}
</script>

{#if admin}
	<span class="flex shrink-0 items-center gap-1" data-testid="admin-badge">
		<a
			href={resolve('/admin/content')}
			title={m.gate_admin_as({ email: admin })}
			class="flex min-h-9 items-center gap-1 rounded-full bg-lagoon px-3 type-label text-on-lagoon no-underline"
			><ShieldCheck size={16} aria-hidden="true" />{m.gate_admin()}</a
		>
		<button
			type="button"
			onclick={exit}
			title={m.gate_exit()}
			class={[
				'flex min-h-11 items-center gap-1 rounded-full type-label text-text-2 hover:bg-surface-2 hover:text-text',
				compact ? 'min-w-11 justify-center' : 'px-3'
			]}
			aria-label={compact ? m.gate_exit() : undefined}
			><LogOut size={18} aria-hidden="true" />{#if !compact}{m.gate_exit()}{/if}</button
		>
	</span>
{/if}
