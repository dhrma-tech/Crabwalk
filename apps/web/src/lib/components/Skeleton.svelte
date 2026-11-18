<script lang="ts">
	// Report 2 §8: sunken grey blocks with one lighter band (`::after`, transform only) moving across each group
	// (brief section 4.4), static under reduced motion. `shape` draws the real layout (photo card, list row, text
	// lines); without it, one block sized by `class`.
	let { shape, class: cls = 'h-4 w-full' }: { shape?: 'card' | 'row' | 'text'; class?: string } =
		$props();
</script>

{#if shape === 'card'}
	<div class="skg rounded-lg bg-surface shadow-e1" aria-hidden="true">
		<div class="sk aspect-[4/3] rounded-t-lg"></div>
		<div class="flex flex-col gap-2 p-3.5">
			<div class="sk h-5 w-3/4 rounded-sm"></div>
			<div class="sk h-4 w-1/2 rounded-sm"></div>
			<div class="sk mt-1 h-1 w-full rounded-full"></div>
		</div>
	</div>
{:else if shape === 'row'}
	<div class="skg flex items-center gap-3.5 p-3" aria-hidden="true">
		<div class="sk size-24 shrink-0 rounded-md"></div>
		<div class="flex flex-1 flex-col gap-2">
			<div class="sk h-5 w-2/3 rounded-sm"></div>
			<div class="sk h-4 w-1/2 rounded-sm"></div>
			<div class="sk mt-1 h-1 w-full rounded-full"></div>
		</div>
	</div>
{:else if shape === 'text'}
	<div class="skg flex flex-col gap-2" aria-hidden="true">
		<div class="sk h-4 w-full rounded-sm"></div>
		<div class="sk h-4 w-11/12 rounded-sm"></div>
		<div class="sk h-4 w-2/3 rounded-sm"></div>
	</div>
{:else}
	<div class={['sk skg', cls]} aria-hidden="true"></div>
{/if}

<style>
	.sk {
		background-color: var(--surface-2);
	}
	.skg {
		position: relative;
		overflow: hidden;
	}
	.skg::after {
		content: '';
		position: absolute;
		inset-block: 0;
		left: 0;
		width: 40%;
		background: linear-gradient(90deg, transparent, var(--surface-3), transparent);
		transform: translateX(-100%);
		animation: shimmer var(--dur-shimmer) linear infinite;
		pointer-events: none;
	}
	@keyframes shimmer {
		to {
			transform: translateX(250%);
		}
	}
</style>
