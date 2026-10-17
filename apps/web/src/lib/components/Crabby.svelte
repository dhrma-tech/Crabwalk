<script lang="ts">
	// Placeholder mascot (FRONTEND §3, artist [OPEN]). Swap this one file when the real art lands.
	// Never render on emergency/safety UI.
	let {
		size = 48,
		walking = false,
		label
	}: { size?: number; walking?: boolean; label?: string } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 64 64"
	class={['crabby', walking && 'walking']}
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
>
	<g fill="none" stroke="#8C3420" stroke-width="3" stroke-linecap="round">
		<path d="M14 40 6 46M14 44 8 52M50 40l8 6M50 44l6 8" />
		<path d="M22 22 18 12M42 22l4-10" />
	</g>
	<circle cx="14" cy="16" r="7" fill="#B5462B" />
	<circle cx="50" cy="16" r="7" fill="#B5462B" />
	<ellipse cx="32" cy="38" rx="20" ry="14" fill="#B5462B" />
	<circle cx="26" cy="30" r="4" fill="#FBF8F2" />
	<circle cx="38" cy="30" r="4" fill="#FBF8F2" />
	<circle cx="26.5" cy="30.5" r="2" fill="#1E1B16" />
	<circle cx="38.5" cy="30.5" r="2" fill="#1E1B16" />
	<path d="M27 41q5 4 10 0" fill="none" stroke="#4A1A0E" stroke-width="2" stroke-linecap="round" />
</svg>

<style>
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
