<script lang="ts">
	// FRONTEND §6.12: sand-100 shimmer; static under reduced motion (global rule stops the animation).
	let { class: cls = 'h-4 w-full' }: { class?: string } = $props();
</script>

<div class={['skeleton rounded-input bg-sand-100 dark:bg-raised', cls]} aria-hidden="true"></div>

<style>
	.skeleton {
		background-image: linear-gradient(
			90deg,
			transparent 0%,
			rgb(255 255 255 / 0.35) 50%,
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
