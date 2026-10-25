<script lang="ts">
	// Crabby placeholder (Report 2 §6): kokum body, eye stalks with white eyes, two claws; flat, legible at 24 px.
	// `white` draws it on kokum fills (raised nav button, collapsed dock button). Swap this one file when the art
	// lands. States: idle, `walking` (sidestep loader), `waving` (success: the right claw waves twice). The global
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
	const eye = $derived(tone === 'white' ? 'var(--kokum)' : '#ffffff');
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
	<path
		d="M20 22 18.5 14M28 22l1.5-8M12.5 35l-6 4M15 39l-3.5 4.5M35.5 35l6 4M33 39l3.5 4.5M13.5 28l-4-5"
		fill="none"
		stroke={body}
		stroke-width="3"
		stroke-linecap="round"
	/>
	<!-- Claws: open pincers, a circle (r 5.5) with a 56° wedge cut out at the top. -->
	<path d="M8 19 5.42 14.14A5.5 5.5 0 1 0 10.58 14.14z" fill={body} />
	<g class={waving ? 'waving' : undefined}>
		<path d="M34.5 28l4-5" fill="none" stroke={body} stroke-width="3" stroke-linecap="round" />
		<path d="M40 19l2.58-4.86A5.5 5.5 0 1 1 37.42 14.14z" fill={body} />
	</g>
	<ellipse cx="24" cy="31" rx="13" ry="9.5" fill={body} />
	<circle cx="18" cy="10" r="4" fill={eye} stroke={body} stroke-width="1.5" />
	<circle cx="30" cy="10" r="4" fill={eye} stroke={body} stroke-width="1.5" />
	<circle cx="18.6" cy="10.4" r="1.7" fill={body} />
	<circle cx="29.4" cy="10.4" r="1.7" fill={body} />
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
	/* Success: the right claw rotates 20° twice from the shoulder. */
	.waving {
		transform-origin: 34.5px 28px;
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
