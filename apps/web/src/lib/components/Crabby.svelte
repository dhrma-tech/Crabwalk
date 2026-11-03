<script lang="ts">
	// Crabby (user art, 2026-11-03): flat silhouette, a rounded body with two eye bumps, open claws and three pointed
	// legs a side; legible at 24 px. `white` draws it on kokum fills (raised nav button, collapsed dock button).
	// States: idle, `walking` (sidestep loader), `waving` (success: the right claw waves twice). The global
	// reduced-motion rule stops both. Never on emergency/safety UI.
	let {
		size = 48,
		walking = false,
		waving = false,
		tone = 'kokum',
		label
	}: {
		size?: number;
		walking?: boolean;
		waving?: boolean;
		tone?: 'kokum' | 'white';
		label?: string;
	} = $props();
	const body = $derived(tone === 'white' ? '#ffffff' : 'var(--kokum)');
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 48 48"
	class={['crabby', walking && 'walking']}
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
>
	<g fill={body}>
		<!-- Legs: curved blades, base at the body, tip outward (top, middle, bottom; then mirrored). -->
		<path
			d="M10.9 22.6Q6.4 21.3 5.1 17Q6.8 22.6 9.7 24.6ZM11.3 25.8Q5 24.4 1.6 25.3Q5.8 28.6 10.3 27.9ZM13.2 29.6Q10 31 10.8 39.4Q12.2 33 15.8 31.4Z"
		/>
		<path
			d="M37.1 22.6Q41.6 21.3 42.9 17Q41.2 22.6 38.3 24.6ZM36.7 25.8Q43 24.4 46.4 25.3Q42.2 28.6 37.7 27.9ZM34.8 29.6Q38 31 37.2 39.4Q35.8 33 32.2 31.4Z"
		/>
		<!-- Claws: hooked pincers, a circle (r 4.3) with a 60° notch toward the inner top, its point off-centre. -->
		<path d="M13.9 15 13.9 12.2A4.3 4.3 0 1 0 16.6 15.5z" />
		<path class={waving ? 'waving' : undefined} d="M34.1 15 34.1 12.2A4.3 4.3 0 1 1 31.4 15.5z" />
		<path
			d="M24 17C31 17 35.4 20.5 35.9 24.4C35.9 28.4 29.3 32.8 24 34.1C18.7 32.8 12.1 28.4 12.1 24.4C12.6 20.5 17 17 24 17Z"
		/>
		<circle cx="19.6" cy="17.4" r="1.4" />
		<circle cx="28.4" cy="17.4" r="1.4" />
	</g>
</svg>

<style>
	/* Loader: Crabby walks sideways (FRONTEND §6.13). */
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
	/* Success: the right claw rotates 20° twice from where it meets the body. */
	.waving {
		transform-origin: 33px 19px;
		animation: wave 0.9s var(--ease) 1;
	}
	@keyframes wave {
		0%,
		50%,
		100% {
			transform: rotate(0deg);
		}
		25%,
		75% {
			transform: rotate(20deg);
		}
	}
</style>
