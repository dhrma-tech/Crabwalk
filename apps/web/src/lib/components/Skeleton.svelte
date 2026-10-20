<script lang="ts">
	// FRONTEND §6.12: hairline-tone blocks (Suna 3a) with a soft shimmer; static under reduced motion.
	let { class: cls = 'h-4 w-full' }: { class?: string } = $props();
</script>

<div class={['skeleton bg-border', cls]} aria-hidden="true"></div>

<style>
	.skeleton {
		background-image: linear-gradient(
			90deg,
			transparent 0%,
			color-mix(in srgb, var(--bg) 45%, transparent) 50%,
			transparent 100%
		);
		background-size: 200% 100%;
		background-repeat: no-repeat;
		animation: shimmer 1.4s linear infinite;
	}
	@keyframes shimmer {
		from {
			background-position: 150% 0;
		}
		to {
			background-position: -50% 0;
		}
	}
</style>
