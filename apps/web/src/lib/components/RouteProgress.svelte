<script lang="ts">
	import { navigating } from '$app/state';
	import { dur } from '#lib/motion.ts';

	// Brief section 4.4: a 2 px line under the top bar when a navigation takes more than 150 ms; it grows to 80 %
	// over 2 s, then completes and fades out.
	let phase = $state<'idle' | 'run' | 'done'>('idle');
	$effect(() => {
		if (!navigating.to) return;
		const t = setTimeout(() => (phase = 'run'), 150);
		return () => {
			clearTimeout(t);
			if (phase !== 'run') return;
			phase = 'done';
			setTimeout(() => phase === 'done' && (phase = 'idle'), dur(180));
		};
	});
</script>

<div class={['rp z-overlay print:hidden', phase !== 'idle' && phase]} aria-hidden="true"></div>

<style>
	.rp {
		position: fixed;
		inset-inline: 0;
		top: calc(env(safe-area-inset-top) + var(--bar-h));
		height: 2px;
		background: var(--kokum);
		transform: scaleX(0);
		transform-origin: left;
		opacity: 0;
		pointer-events: none;
	}
	.run {
		opacity: 1;
		transform: scaleX(0.8);
		transition: transform 2s var(--ease);
	}
	.done {
		transform: scaleX(1);
		transition:
			transform var(--dur-exit) var(--ease),
			opacity var(--dur-exit) var(--ease);
	}
</style>
