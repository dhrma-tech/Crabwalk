<script lang="ts" generics="T extends string | number">
	import { untrack } from 'svelte';
	// Segmented control (Report 2 §8): sunken pill track, the selected option a raised surface thumb. A radio
	// group: one tab stop, arrow keys move the choice. Long Marathi labels wrap onto a second row.
	// Brief section 4.6 / 4.7: one thumb slides to the choice (`transform` only; its size snaps). Before it is
	// measured (server render), the selected button draws its own background. `value` may be null: none chosen.
	let {
		options,
		value = $bindable(),
		label,
		onchange
	}: {
		options: { value: T; label: string }[];
		value: T | null;
		label: string;
		onchange?: (value: T) => void;
	} = $props();

	let group: HTMLDivElement;
	let thumb = $state<{ x: number; y: number; w: number; h: number } | null>(null);
	let moved = $state(false);
	function pick(v: T) {
		value = v;
		onchange?.(v);
	}
	function key(e: KeyboardEvent) {
		const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
		if (!step) return;
		e.preventDefault();
		const i = options.findIndex((o) => o.value === value);
		const next = i < 0 ? 0 : (i + step + options.length) % options.length;
		pick(options[next]!.value);
		group.querySelectorAll('button')[next]?.focus();
	}
	// Follows the choice, label changes and wrapping (resize).
	$effect(() => {
		const i = options.findIndex((o) => o.value === value);
		const place = () =>
			untrack(() => {
				const b = group.querySelectorAll('button')[i];
				const next = b && { x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight };
				if (thumb && next && (thumb.x !== next.x || thumb.y !== next.y)) moved = true;
				thumb = next ?? null;
			});
		place();
		const ro = new ResizeObserver(place);
		ro.observe(group);
		return () => ro.disconnect();
	});
</script>

<div
	bind:this={group}
	role="radiogroup"
	aria-label={label}
	tabindex="-1"
	class="relative inline-flex max-w-full flex-wrap rounded-full bg-surface-2 p-0.5"
	onkeydown={key}
>
	{#if thumb}
		<span
			class={[
				'pointer-events-none absolute top-0 left-0 rounded-full bg-surface shadow-e1',
				moved && 'transition-transform duration-(--dur-state) ease-(--ease-inout)'
			]}
			style:width="{thumb.w}px"
			style:height="{thumb.h}px"
			style:transform="translate({thumb.x}px, {thumb.y}px)"
			aria-hidden="true"
		></span>
	{/if}
	{#each options as o, i (o.value)}
		{@const on = o.value === value}
		<button
			type="button"
			role="radio"
			aria-checked={on}
			tabindex={on || (value == null && i === 0) ? 0 : -1}
			class={[
				'relative min-h-11 min-w-11 rounded-full px-4 type-label',
				'transition-[background-color,box-shadow,color] duration-(--dur-state) ease-brand',
				on ? 'text-text' : 'text-text-2 hover:text-text',
				on && !thumb && 'bg-surface shadow-e1'
			]}
			onclick={() => pick(o.value)}>{o.label}</button
		>
	{/each}
</div>
