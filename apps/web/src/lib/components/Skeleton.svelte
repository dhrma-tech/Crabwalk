<script lang="ts">
	// Report 2 §8: sunken grey with a moving lighter band (1.2 s), static under reduced motion. `shape` draws the
	// real layout (photo card, list row, text lines); without it, one block sized by `class`.
	let { shape, class: cls = 'h-4 w-full' }: { shape?: 'card' | 'row' | 'text'; class?: string } =
		$props();
</script>

{#if shape === 'card'}
	<div class="rounded-lg bg-surface shadow-e1" aria-hidden="true">
		<div class="sk aspect-[4/3] rounded-t-lg"></div>
		<div class="flex flex-col gap-2 p-3.5">
			<div class="sk h-5 w-3/4 rounded-sm"></div>
			<div class="sk h-4 w-1/2 rounded-sm"></div>
			<div class="sk mt-1 h-1 w-full rounded-full"></div>
		</div>
	</div>
{:else if shape === 'row'}
	<div class="flex items-center gap-3.5 p-3" aria-hidden="true">
		<div class="sk size-24 shrink-0 rounded-md"></div>
		<div class="flex flex-1 flex-col gap-2">
			<div class="sk h-5 w-2/3 rounded-sm"></div>
			<div class="sk h-4 w-1/2 rounded-sm"></div>
			<div class="sk mt-1 h-1 w-full rounded-full"></div>
		</div>
	</div>
{:else if shape === 'text'}
	<div class="flex flex-col gap-2" aria-hidden="true">
		<div class="sk h-4 w-full rounded-sm"></div>
		<div class="sk h-4 w-11/12 rounded-sm"></div>
		<div class="sk h-4 w-2/3 rounded-sm"></div>
	</div>
{:else}
	<div class={['sk', cls]} aria-hidden="true"></div>
{/if}

<style>
	.sk {
		background-color: var(--surface-2);
		background-image: linear-gradient(
			90deg,
			transparent 0%,
			var(--surface-3) 50%,
			transparent 100%
		);
		background-size: 200% 100%;
		background-repeat: no-repeat;
		animation: shimmer var(--dur-shimmer) linear infinite;
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
