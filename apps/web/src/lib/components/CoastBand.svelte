<script lang="ts">
	import { onMount } from 'svelte';

	// Discover hero (T1-07, brief section 4.9): three wave lines behind the heading, each drifting on `translateX`
	// at --dur-ambient × 1, 1.4, 1.9. Decorative. Paused off-screen; off under reduced motion and data saver
	// (`html[data-lite]`). The heading in front is the LCP element and never moves.
	let band: HTMLDivElement;
	let away = $state(false);
	onMount(() => {
		const io = new IntersectionObserver(([e]) => (away = !e?.isIntersecting));
		io.observe(band);
		return () => io.disconnect();
	});
</script>

<div
	bind:this={band}
	class={['band pointer-events-none absolute inset-x-0 -z-10 h-24 overflow-hidden', away && 'away']}
	aria-hidden="true"
>
	<span class="top-3 bg-lagoon-100 [--k:1]"></span>
	<span class="top-10 bg-kokum-100 [--k:1.4]"></span>
	<span class="top-17 bg-alphonso-50 [--k:1.9]"></span>
</div>

<style>
	span {
		position: absolute;
		left: 0;
		width: calc(100% + 40px);
		height: 14px;
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='14'%3E%3Cpath d='M0 7q10-6 20 0t20 0' fill='none' stroke='%23000' stroke-width='2'/%3E%3C/svg%3E")
			0 0 / 40px 14px repeat-x;
		animation: drift calc(var(--dur-ambient) * var(--k)) linear infinite;
	}
	.away span {
		animation-play-state: paused;
	}
	:global(html[data-lite]) span {
		animation: none;
	}
	@keyframes drift {
		to {
			transform: translateX(-40px); /* one wave: the loop has no seam */
		}
	}
</style>
