<script lang="ts">
	// Six-digit code (brief §8): six boxes, the first carries autocomplete="one-time-code" so phones can fill it;
	// typing advances, Backspace goes back, a pasted code fills every box. `oncomplete` fires with all six digits.
	let {
		value = $bindable(''),
		label,
		digitLabel,
		invalid = false,
		describedby,
		oncomplete
	}: {
		value?: string;
		label: string;
		digitLabel: (n: number) => string;
		invalid?: boolean;
		describedby?: string;
		oncomplete?: (code: string) => void;
	} = $props();

	let boxes: HTMLInputElement[] = $state([]);
	const digits = $derived(Array.from({ length: 6 }, (_, i) => value[i] ?? ''));

	function set(next: string, focus?: number) {
		value = next.replace(/\D/g, '').slice(0, 6);
		if (focus !== undefined) boxes[Math.min(5, focus)]?.focus();
		if (value.length === 6) oncomplete?.(value);
	}
	function input(e: Event, i: number) {
		const el = e.currentTarget as HTMLInputElement;
		const typed = el.value.replace(/\D/g, '');
		if (typed.length > 1) return set(typed, typed.length); // autofill or paste into one box
		const arr = digits.slice();
		arr[i] = typed;
		set(arr.join(''), typed ? i + 1 : i);
		el.value = arr[i];
	}
	function key(e: KeyboardEvent, i: number) {
		if (e.key === 'Backspace' && !digits[i] && i > 0) {
			e.preventDefault();
			const arr = digits.slice();
			arr[i - 1] = '';
			set(arr.join(''), i - 1);
		} else if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
		else if (e.key === 'ArrowRight' && i < 5) boxes[i + 1].focus();
	}
	function paste(e: ClipboardEvent) {
		const t = e.clipboardData?.getData('text') ?? '';
		if (!/\d/.test(t)) return;
		e.preventDefault();
		set(t, t.replace(/\D/g, '').length);
	}
</script>

<fieldset class={['otp', invalid && 'invalid']}>
	<legend>{label}</legend>
	<div class="row">
		{#each digits as d, i (i)}
			<input
				bind:this={boxes[i]}
				value={d}
				inputmode="numeric"
				pattern="[0-9]*"
				maxlength={i === 0 ? 6 : 1}
				autocomplete={i === 0 ? 'one-time-code' : 'off'}
				aria-label={digitLabel(i + 1)}
				aria-invalid={invalid}
				aria-describedby={describedby}
				oninput={(e) => input(e, i)}
				onkeydown={(e) => key(e, i)}
				onpaste={paste}
				onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
			/>
		{/each}
	</div>
</fieldset>

<style>
	.otp {
		margin: 0;
		padding: 0;
		border: 0;
	}
	legend {
		margin-bottom: 8px;
		font-size: 14px;
		font-weight: 600;
	}
	.row {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 8px;
	}
	input {
		width: 100%;
		min-width: 0;
		height: 58px;
		border: 1.5px solid var(--line);
		border-radius: 14px;
		background: var(--white);
		color: var(--navy);
		font: 400 26px var(--j-display);
		text-align: center;
		caret-color: var(--laterite);
		transition:
			border-color 0.2s,
			transform 0.25s var(--j-spring);
	}
	input:focus {
		outline: none;
		border-color: var(--navy);
		box-shadow: 3px 3px 0 var(--navy);
		transform: translateY(-2px);
	}
	.invalid input {
		border-color: var(--laterite);
		animation: shake 0.4s;
	}
	@keyframes shake {
		25% {
			translate: -4px 0;
		}
		75% {
			translate: 4px 0;
		}
	}
</style>
