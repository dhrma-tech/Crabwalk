<script lang="ts" generics="T extends string | number">
	// Segmented control (Report 2 §8): sunken pill track, the selected option a raised surface thumb. A radio
	// group: one tab stop, arrow keys move the choice. Long Marathi labels wrap onto a second row.
	let {
		options,
		value = $bindable(),
		label,
		onchange
	}: {
		options: { value: T; label: string }[];
		value: T;
		label: string;
		onchange?: (value: T) => void;
	} = $props();

	let group: HTMLDivElement;
	function pick(v: T) {
		value = v;
		onchange?.(v);
	}
	function key(e: KeyboardEvent) {
		const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
		if (!step) return;
		e.preventDefault();
		const i = options.findIndex((o) => o.value === value);
		const next = (i + step + options.length) % options.length;
		pick(options[next]!.value);
		group.querySelectorAll('button')[next]?.focus();
	}
</script>

<div
	bind:this={group}
	role="radiogroup"
	aria-label={label}
	tabindex="-1"
	class="inline-flex max-w-full flex-wrap rounded-full bg-surface-2 p-0.5"
	onkeydown={key}
>
	{#each options as o (o.value)}
		{@const on = o.value === value}
		<button
			type="button"
			role="radio"
			aria-checked={on}
			tabindex={on ? 0 : -1}
			class={[
				'min-h-11 min-w-11 rounded-full px-4 type-label',
				'transition-[background-color,box-shadow,color] duration-(--dur-state) ease-brand',
				on ? 'bg-surface text-text shadow-e1' : 'text-text-2 hover:text-text'
			]}
			onclick={() => pick(o.value)}>{o.label}</button
		>
	{/each}
</div>
