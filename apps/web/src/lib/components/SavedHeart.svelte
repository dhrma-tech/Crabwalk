<script lang="ts">
	import Heart from '@lucide/svelte/icons/heart';
	import { dur } from '#lib/motion.ts';

	// Brief section 4.7: saving pops the heart (1 → 1.3 → 1, spring, --dur-emph); unsaving fades the fill
	// (--dur-instant). The parent bumps `pop` on a save tap only, so a heart that loads as saved stays still.
	let { on, pop = 0 }: { on: boolean; pop?: number } = $props();
	let el: HTMLSpanElement;
	$effect(() => {
		if (pop)
			el.animate(
				[{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }],
				{
					duration: dur(480),
					easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
				}
			);
	});
</script>

<span bind:this={el} class="flex" data-heart>
	<Heart
		size={20}
		fill="currentColor"
		aria-hidden="true"
		class={['transition-[color,fill-opacity] duration-(--dur-instant)', on && 'text-kokum']}
		style="fill-opacity: {on ? 1 : 0}"
	/>
</span>
