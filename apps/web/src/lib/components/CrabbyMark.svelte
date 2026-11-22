<script lang="ts">
	// Crabby's small mark for the app shell (nav button, dock, loaders, chat): the same fiddler-crab silhouette as
	// Crabby.svelte's mark mode, without states, eye-follow or props, so the shell stays inside its 210 KB budget
	// (DECISIONS L-1, LJ-12). `walking` = sidestep loader, `waving` = success wave, `tone="white"` for filled
	// buttons. The full character (seven states) is Crabby.svelte. Never on emergency/safety UI.
	let {
		size = 48,
		walking = false,
		waving = false,
		tone = 'color',
		label
	}: {
		size?: number;
		walking?: boolean;
		waving?: boolean;
		tone?: 'color' | 'kokum' | 'white';
		label?: string;
	} = $props();
	const white = $derived(tone === 'white');
	const ink = $derived(white ? '#fff' : '#2f4156');
	const shell = $derived(white ? '#fff' : '#b5462b');
	const pale = $derived(white ? '#fff' : '#f5efeb');
</script>

<svg
	width={size}
	height={size}
	viewBox="20 22 192 192"
	class={['mark', walking && 'walking']}
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
>
	<g transform="translate(3 46)" stroke={ink} stroke-linecap="round" stroke-linejoin="round">
		<path
			d="M62 100Q46 88 33 96L23 113M61 108Q42 102 31 113L25 131M66 116Q50 117 42 130L40 146M138 100Q154 88 167 96L177 113M139 108Q158 102 169 113L175 131M134 116Q150 117 158 130L160 146"
			fill="none"
			stroke-width="8.4"
		/>
		<path d="M60 100C52 101 45 105 41 111" fill="none" stroke-width="9" />
		<path
			d="M43 108C34 106 28 112 30 119C31 124 37 126 41 123L37 118L44 117C46 114 46 110 43 108Z"
			fill={shell}
			stroke-width="5"
		/>
		<path
			d="M66 116C72 126 88 131 100 131C112 131 128 126 134 116C120 122 80 122 66 116Z"
			fill={pale}
			stroke-width="5"
		/>
		<path
			d="M53 83C53 73 62 68 73 68L127 68C138 68 147 73 147 83C147 100 138 116 123 121C110 126 90 126 77 121C62 116 53 100 53 83Z"
			fill={shell}
			stroke-width="5"
		/>
		<path d="M91 70C90 60 88 50 85 40M109 70C110 60 112 50 115 40" fill="none" stroke-width="9.2" />
		<circle cx="84" cy="26" r="14" fill="#fff" stroke-width="5" />
		<circle cx="116" cy="26" r="14" fill="#fff" stroke-width="5" />
		<circle
			cx="84"
			cy="27"
			r="7.5"
			fill={white ? 'var(--kokum, #0270ae)' : '#1f2c3b'}
			stroke="none"
		/>
		<circle
			cx="116"
			cy="27"
			r="7.5"
			fill={white ? 'var(--kokum, #0270ae)' : '#1f2c3b'}
			stroke="none"
		/>
		<g class={['claw', waving && 'waving']}>
			<path
				d="M139 93C147 92 153 88 157 81L169 90C163 101 152 107 141 107Z"
				fill={shell}
				stroke-width="5"
			/>
			<path
				d="M155 54C141 36 145 4 172 -16C168 4 172 22 179 36C168 38 160 45 155 54Z"
				fill={pale}
				stroke-width="5"
			/>
			<path
				d="M158 86C148 74 150 54 160 44C170 34 188 32 200 40C212 48 212 70 204 84C196 98 176 102 164 96C161 94 159 90 158 86Z"
				fill={shell}
				stroke-width="5"
			/>
			<path
				d="M184 35C187 18 187 -2 179 -21C202 -14 213 12 207 46C201 40 192 36 184 35Z"
				fill={pale}
				stroke-width="5"
			/>
		</g>
	</g>
</svg>

<style>
	.mark {
		display: inline-block;
		flex: none;
		overflow: visible;
	}
	.walking {
		animation: sidestep calc(var(--dur-page, 300ms) * 2) var(--ease, ease) infinite alternate;
	}
	@keyframes sidestep {
		from {
			transform: translateX(-3px);
		}
		to {
			transform: translateX(3px);
		}
	}
	.claw {
		transform-box: fill-box;
		transform-origin: 2% 88%;
	}
	.waving {
		animation: wave calc(var(--dur-page, 300ms) * 3) var(--ease, ease) 2;
	}
	@keyframes wave {
		50% {
			transform: rotate(-24deg);
		}
	}
</style>
