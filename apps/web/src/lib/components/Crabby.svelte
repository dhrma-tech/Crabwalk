<script lang="ts">
	// Crabby as a small seal-like mark (Suna 2a): an aizome circle with two eyes; `outline` for chat avatars.
	// Placeholder until the real art lands (FRONTEND §3) — swap this one file. Never on emergency/safety UI.
	let {
		size = 48,
		walking = false,
		outline = false,
		label
	}: { size?: number; walking?: boolean; outline?: boolean; label?: string } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 52 52"
	class={['crabby', walking && 'walking']}
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
>
	{#if outline}
		<circle cx="26" cy="26" r="25" fill="none" stroke="var(--text)" stroke-width="2" />
		<circle cx="20" cy="26" r="2.5" fill="var(--text)" />
		<circle cx="32" cy="26" r="2.5" fill="var(--text)" />
	{:else}
		<circle cx="26" cy="26" r="26" fill="var(--cta)" />
		<circle cx="20" cy="26" r="2.5" fill="var(--on-cta)" />
		<circle cx="32" cy="26" r="2.5" fill="var(--on-cta)" />
	{/if}
</svg>

<style>
	/* Loader: Crabby walks sideways (FRONTEND §6.13); the global reduced-motion rule stops it. */
	.walking {
		animation: sidestep 0.6s var(--ease) infinite alternate;
	}
	@keyframes sidestep {
		from {
			transform: translateX(-3px);
		}
		to {
			transform: translateX(3px);
		}
	}
</style>
