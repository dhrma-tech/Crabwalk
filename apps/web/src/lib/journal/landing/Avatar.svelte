<script lang="ts">
	// Illustrated traveller (brief §7.8): clearly a drawing, never a real or AI face. Ink outline, flat riso fills.
	let {
		bg,
		skin,
		hair,
		style,
		shirt,
		extra = null,
		label
	}: {
		bg: string;
		skin: string;
		hair: string;
		style: 'short' | 'long' | 'bun' | 'cap' | 'bald';
		shirt: string;
		extra?: 'glasses' | 'bindi' | 'beard' | null;
		label?: string;
	} = $props();
</script>

<svg
	viewBox="0 0 100 118"
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
>
	<rect width="100" height="118" fill={bg} />
	<circle cx="78" cy="20" r="9" fill="#ffffff" opacity=".5" />
	{#if style === 'long'}<path d="M29 52 C26 26 74 26 71 52 L74 96 L26 96 Z" fill={hair} />{/if}
	{#if style === 'bun'}<circle
			cx="50"
			cy="23"
			r="9"
			fill={hair}
			stroke="#2f4156"
			stroke-width="1.6"
		/>{/if}
	<path d="M44 60 h12 v16 h-12 z" fill={skin} stroke="#2f4156" stroke-width="1.6" />
	<path
		d="M13 119 C15 92 31 77 50 77 S85 92 87 119 Z"
		fill={shirt}
		stroke="#2f4156"
		stroke-width="1.8"
		stroke-linejoin="round"
	/>
	<path
		d="M42 78 L50 88 L58 78"
		fill="none"
		stroke="#2f4156"
		stroke-width="1.6"
		stroke-linejoin="round"
	/>
	<ellipse cx="50" cy="47" rx="17" ry="19" fill={skin} stroke="#2f4156" stroke-width="1.8" />
	<!-- face: two ink dots and a small smile; eyes do the talking -->
	<circle cx="43.5" cy="48" r="1.6" fill="#2f4156" />
	<circle cx="56.5" cy="48" r="1.6" fill="#2f4156" />
	<path
		d="M45 56 q5 3.6 10 0"
		fill="none"
		stroke="#2f4156"
		stroke-width="1.6"
		stroke-linecap="round"
	/>
	<circle cx="40" cy="53" r="2.6" fill="#b5462b" opacity=".18" />
	<circle cx="60" cy="53" r="2.6" fill="#b5462b" opacity=".18" />
	{#if style === 'short'}<path
			d="M33 45 C32 27 68 27 67 45 C61 35 41 35 33 45 Z"
			fill={hair}
			stroke="#2f4156"
			stroke-width="1.6"
			stroke-linejoin="round"
		/>{/if}
	{#if style === 'long'}<path
			d="M33 44 C34 28 66 28 67 44 C58 36 42 36 33 44 Z"
			fill={hair}
			stroke="#2f4156"
			stroke-width="1.6"
			stroke-linejoin="round"
		/>{/if}
	{#if style === 'bun'}<path
			d="M33 46 C33 30 67 30 67 46 C60 38 40 38 33 46 Z"
			fill={hair}
			stroke="#2f4156"
			stroke-width="1.6"
			stroke-linejoin="round"
		/>{/if}
	{#if style === 'cap'}<path
			d="M32 41 C33 25 67 25 68 41 Z M66 39 L84 43 L66 44 Z"
			fill={hair}
			stroke="#2f4156"
			stroke-width="1.6"
			stroke-linejoin="round"
		/>{/if}
	{#if extra === 'glasses'}<g fill="none" stroke="#2f4156" stroke-width="1.5"
			><circle cx="43.5" cy="48" r="5" /><circle cx="56.5" cy="48" r="5" /><path
				d="M48.5 48 h3"
			/></g
		>{/if}
	{#if extra === 'bindi'}<circle cx="50" cy="40.5" r="1.4" fill="#b5462b" />{/if}
	{#if extra === 'beard'}<path
			d="M34 50 C36 66 64 66 66 50 C62 60 38 60 34 50 Z"
			fill={hair}
			stroke="#2f4156"
			stroke-width="1.4"
		/>{/if}
</svg>

<style>
	svg {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
