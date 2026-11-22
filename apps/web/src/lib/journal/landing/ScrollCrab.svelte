<script lang="ts">
	import { onMount } from 'svelte';
	import { reducedMotion } from '#lib/motion.ts';
	import Crabby, { type CrabbyState } from '#lib/components/Crabby.svelte';

	// Scroll progress as a crab walk (brief §7.6): a tiny Crabby on the bottom edge moves with page progress,
	// scuttles in the scroll direction and idles when scrolling stops. Not on very small screens, never under
	// reduced motion. Decorative; the page keeps its own scroll bar.
	let p = $state(0);
	let pose = $state<CrabbyState>('idle');
	let flip = $state(false);
	let on = $state(false);

	onMount(() => {
		if (reducedMotion.current) return;
		on = true;
		let last = scrollY;
		let raf = 0;
		let idle: ReturnType<typeof setTimeout>;
		const update = () => {
			raf = 0;
			const max = document.documentElement.scrollHeight - innerHeight;
			p = max > 0 ? Math.min(1, scrollY / max) : 0;
			const dy = scrollY - last;
			if (Math.abs(dy) > 1) {
				flip = dy < 0;
				pose = 'scuttle';
				clearTimeout(idle);
				idle = setTimeout(() => (pose = 'idle'), 220);
			}
			last = scrollY;
		};
		const onScroll = () => (raf ||= requestAnimationFrame(update));
		addEventListener('scroll', onScroll, { passive: true });
		update();
		return () => {
			removeEventListener('scroll', onScroll);
			cancelAnimationFrame(raf);
			clearTimeout(idle);
		};
	});
</script>

{#if on}
	<div class="walk" aria-hidden="true">
		<span class="trail" style:width="{p * 100}%"></span>
		<span class="crab" style:left="calc({p} * (100% - 44px))">
			<Crabby size={44} state={pose} {flip} follow={false} speed={0.8} />
		</span>
	</div>
{/if}

<style>
	.walk {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 50;
		height: 46px;
		pointer-events: none;
	}
	.trail {
		position: absolute;
		left: 0;
		bottom: 4px;
		height: 0;
		border-top: 2px dotted var(--navy);
		opacity: 0.35;
	}
	.crab {
		position: absolute;
		bottom: -4px;
	}
	@media (max-width: 480px) {
		.walk {
			display: none;
		}
	}
</style>
