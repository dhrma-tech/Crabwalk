<script module lang="ts">
	// Shared pointer / tilt for every Crabby on the page: one listener, not one per crab.
	type Look = { x: number; y: number; tilt: boolean };
	const look: Look = $state({ x: -1, y: -1, tilt: false });
	let listening = 0;
	let stop = () => {};
	function listen() {
		if (listening++ > 0) return;
		let raf = 0;
		const move = (e: PointerEvent) => {
			if (e.pointerType !== 'mouse' || raf) return;
			raf = requestAnimationFrame(() => {
				raf = 0;
				look.x = e.clientX;
				look.y = e.clientY;
				look.tilt = false;
			});
		};
		// Device tilt only where no permission prompt is needed (Android); iOS asks, so it is left alone.
		type DOE = typeof DeviceOrientationEvent & { requestPermission?: unknown };
		const free =
			typeof DeviceOrientationEvent !== 'undefined' &&
			typeof (DeviceOrientationEvent as DOE).requestPermission !== 'function';
		const tilt = (e: DeviceOrientationEvent) => {
			if (e.gamma == null || e.beta == null) return;
			look.x = innerWidth / 2 + (e.gamma / 30) * innerWidth;
			look.y = innerHeight / 2 + ((e.beta - 45) / 30) * innerHeight;
			look.tilt = true;
		};
		addEventListener('pointermove', move, { passive: true });
		if (free) addEventListener('deviceorientation', tilt, { passive: true });
		stop = () => {
			removeEventListener('pointermove', move);
			removeEventListener('deviceorientation', tilt);
		};
	}
	function unlisten() {
		if (--listening === 0) stop();
	}

	export type CrabbyState = 'idle' | 'wave' | 'scuttle' | 'point' | 'think' | 'celebrate' | 'sleep';
	export const CRABBY_STATES: CrabbyState[] = [
		'idle',
		'wave',
		'scuttle',
		'point',
		'think',
		'celebrate',
		'sleep'
	];
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { reducedMotion } from '#lib/motion.ts';

	// Crabby, a Konkan fiddler crab (docs/crabwalk-handoff/CRABBY_BRIEF.md): one oversized claw, tall eye stalks,
	// laterite shell, beige belly, navy ink line with a little riso grain. Named parts (`body`, `stalkL/R`,
	// `eyeL/R`, `bigClaw`, `smallClaw`, `leg1`–`leg6`) animate per `state`. Below 40 px it draws a bolder mark with no
	// grain or props, so it still reads in a button. The app shell uses the lighter CrabbyMark.svelte (same silhouette)
	// to stay in budget. Old props still work here too: `walking` → scuttle, `waving` → wave,
	// `tone="white"` → a white silhouette for filled buttons. Never on emergency/safety UI.
	let {
		state: pose = 'idle',
		size = 48,
		walking = false,
		waving = false,
		tone = 'color',
		label,
		flip = false,
		follow = true,
		loop = false,
		speed = 1,
		hold = null
	}: {
		state?: CrabbyState;
		size?: number;
		walking?: boolean;
		waving?: boolean;
		tone?: 'color' | 'kokum' | 'white' | 'ink';
		label?: string;
		/** Mirror: the big claw on the viewer's left. */
		flip?: boolean;
		/** Eyes follow the pointer (desktop) or tilt (phones, where no permission is needed). */
		follow?: boolean;
		/** Keep repeating one-shot states (wave, celebrate). */
		loop?: boolean;
		/** Scuttle speed multiplier. */
		speed?: number;
		/** Something held in the big claw (onboarding reactions). */
		hold?: 'baby' | 'gem' | 'leaf' | null;
	} = $props();

	const uid = $props.id();
	const s = $derived<CrabbyState>(walking ? 'scuttle' : waving ? 'wave' : pose);
	const mark = $derived(size < 40);
	const white = $derived(tone === 'white');
	// `kokum` was the old default (a single-colour crab in the app's action colour); it now means full colour.
	const ink = $derived(white ? '#ffffff' : tone === 'ink' ? 'currentColor' : '#2f4156');
	const shell = $derived(white ? '#ffffff' : tone === 'ink' ? 'currentColor' : '#b5462b');
	const shellLight = $derived(white ? '#ffffff' : tone === 'ink' ? 'currentColor' : '#d9785a');
	const belly = $derived(white ? '#ffffff' : tone === 'ink' ? 'currentColor' : '#f5efeb');
	const eyeWhite = $derived(white || tone === 'ink' ? 'transparent' : '#ffffff');
	const pupil = $derived(
		white ? 'var(--kokum, #0270ae)' : tone === 'ink' ? 'currentColor' : '#1f2c3b'
	);
	const sw = $derived(mark ? 5 : 2.6); // ink line weight in viewBox units

	let root = $state<SVGSVGElement>();
	let blink = $state(false);
	let px = $state(0);
	let py = $state(0);

	// Pupils look toward the pointer within a small radius; `think` looks up, `sleep` looks down.
	$effect(() => {
		if (!root || !follow || mark || s === 'sleep' || s === 'think') return;
		if (look.x < 0) return;
		const r = root.getBoundingClientRect();
		const dx = look.x - (r.left + r.width / 2);
		const dy = look.y - (r.top + r.height * 0.3);
		const d = Math.hypot(dx, dy) || 1;
		const m = Math.min(1, d / 260) * 3.4;
		px = (dx / d) * m * (flip ? -1 : 1);
		py = (dy / d) * m;
	});
	const eye = $derived(
		s === 'think' ? [-2.2, -3] : s === 'sleep' ? [0, 2.6] : follow && !mark ? [px, py] : [0, 0]
	);

	onMount(() => {
		if (mark) return;
		if (follow) listen();
		// Blink every 3–6 s at random (brief §6); not under reduced motion, not while asleep.
		let t: ReturnType<typeof setTimeout>;
		const next = () => {
			t = setTimeout(
				() => {
					if (!reducedMotion.current && document.visibilityState === 'visible') {
						blink = true;
						setTimeout(() => (blink = false), 160);
					}
					next();
				},
				3000 + Math.random() * 3000
			);
		};
		next();
		return () => {
			clearTimeout(t);
			if (follow) unlisten();
		};
	});

	// Legs: three a side, two segments each (base → knee → tip). Mirrored for the right side.
	const LEFT = [
		'M62 100 Q46 88 33 96 L23 113',
		'M61 108 Q42 102 31 113 L25 131',
		'M66 116 Q50 117 42 130 L40 146'
	];
	const RIGHT = LEFT.map((d) =>
		d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${200 - +x} ${y}`)
	);
	const legs = [...LEFT, ...RIGHT];
	const STALKS = [
		{ side: 'L', d: 'M91 70 C90 60 88 50 85 40', ex: 84, ey: 26 },
		{ side: 'R', d: 'M109 70 C110 60 112 50 115 40', ex: 116, ey: 26 }
	];
</script>

<svg
	bind:this={root}
	width={size}
	height={size}
	viewBox={mark ? '20 22 192 192' : '0 0 220 220'}
	class={['crabby', `s-${s}`, mark && 'mark', blink && 'blink', loop && 'loop']}
	style:--spd={1 / Math.max(0.25, speed)}
	style:--px="{eye[0]}px"
	style:--py="{eye[1]}px"
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
	overflow="visible"
>
	{#if !mark && !white}
		<defs>
			<!-- Riso grain: a halftone of uneven dots, multiplied over the shell. -->
			<pattern id="g{uid}" width="11" height="11" patternUnits="userSpaceOnUse">
				<circle cx="2" cy="3" r="0.9" fill="#5a1f10" />
				<circle cx="7.5" cy="1.5" r="0.6" fill="#5a1f10" />
				<circle cx="5" cy="7.5" r="1.1" fill="#5a1f10" />
				<circle cx="9.5" cy="9" r="0.5" fill="#5a1f10" />
				<circle cx="1" cy="9.5" r="0.7" fill="#5a1f10" />
			</pattern>
		</defs>
	{/if}
	<g transform={flip ? 'translate(220 0) scale(-1 1)' : undefined}>
		<g transform="translate(3 46)">
			<ellipse
				class="shadow"
				cx="100"
				cy="150"
				rx="70"
				ry="7"
				fill="#2f4156"
				opacity={white ? 0 : 0.14}
			/>
			<g class="hop">
				<!-- legs -->
				{#each legs as d, i (i)}
					<g class="leg leg{i + 1} {i % 2 === 0 ? 'la' : 'lb'}" data-part="leg{i + 1}">
						<path
							{d}
							fill="none"
							stroke={ink}
							stroke-width={sw + 3.4}
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						{#if !mark && !white}
							<path
								{d}
								fill="none"
								stroke={shellLight}
								stroke-width="3"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						{/if}
					</g>
				{/each}

				<!-- small claw (viewer's left) -->
				<g class="smallClaw" data-part="smallClaw">
					<path
						d="M60 100 C52 101 45 105 41 111"
						fill="none"
						stroke={ink}
						stroke-width={sw + 4}
						stroke-linecap="round"
					/>
					{#if !mark && !white}<path
							d="M60 100 C52 101 45 105 41 111"
							fill="none"
							stroke={shellLight}
							stroke-width="3.4"
							stroke-linecap="round"
						/>{/if}
					<path
						d="M43 108 C34 106 28 112 30 119 C31 124 37 126 41 123 L37 118 L44 117 C46 114 46 110 43 108 Z"
						fill={shell}
						stroke={ink}
						stroke-width={sw}
						stroke-linejoin="round"
					/>
				</g>

				<!-- body: carapace with a beige belly, misregistered fill, grain and a highlight -->
				<g class="body" data-part="body">
					<path
						d="M66 116 C72 126 88 131 100 131 C112 131 128 126 134 116 C120 122 80 122 66 116 Z"
						fill={belly}
						stroke={ink}
						stroke-width={sw}
						stroke-linejoin="round"
					/>
					<path
						class="shellfill"
						transform={mark || white ? undefined : 'translate(1.8 1.8)'}
						d="M54 84 C54 74 62 69 73 69 L127 69 C138 69 146 74 146 84 C146 100 137 115 123 120 C110 125 90 125 77 120 C63 115 54 100 54 84 Z"
						fill={shell}
					/>
					{#if !mark && !white}
						<path
							d="M54 84 C54 74 62 69 73 69 L127 69 C138 69 146 74 146 84 C146 100 137 115 123 120 C110 125 90 125 77 120 C63 115 54 100 54 84 Z"
							fill="url(#g{uid})"
							opacity="0.22"
						/>
						<path
							d="M70 78 C84 73 106 73 120 76"
							fill="none"
							stroke={shellLight}
							stroke-width="4"
							stroke-linecap="round"
							opacity="0.9"
						/>
						<path
							d="M84 100 l3 0 M110 96 l3 1 M96 108 l2 0"
							stroke="#7a2a17"
							stroke-width="2.4"
							stroke-linecap="round"
						/>
					{/if}
					<path
						d="M53 83 C53 73 62 68 73 68 L127 68 C138 68 147 73 147 83 C147 100 138 116 123 121 C110 126 90 126 77 121 C62 116 53 100 53 83 Z"
						fill="none"
						stroke={ink}
						stroke-width={sw}
						stroke-linejoin="round"
					/>
					{#if !mark && !white}
						<!-- tiny mouthparts: the only "mouth" (brief: eyes carry the emotion) -->
						<path
							class="mouth"
							d="M95 112 Q100 115 105 112"
							fill="none"
							stroke={ink}
							stroke-width="2.2"
							stroke-linecap="round"
						/>
					{/if}
				</g>

				<!-- eye stalks and eyes -->
				{#each STALKS as { side, d, ex, ey } (side)}
					<g class="stalk stalk{side}" data-part="stalk{side}">
						<path {d} fill="none" stroke={ink} stroke-width={sw + 4.2} stroke-linecap="round" />
						{#if !mark && !white}<path
								{d}
								fill="none"
								stroke={shellLight}
								stroke-width="3.6"
								stroke-linecap="round"
							/>{/if}
						<g class="eye eye{side}" data-part="eye{side}">
							<circle
								cx={ex}
								cy={ey}
								r="14"
								fill={white ? '#ffffff' : eyeWhite}
								stroke={ink}
								stroke-width={sw}
							/>
							<g class="pupil">
								<circle cx={ex} cy={ey + 1} r={mark ? 7.5 : 7} fill={pupil} />
								{#if !mark && !white}
									<circle cx={ex + 2.6} cy={ey - 1.8} r="2.6" fill="#ffffff" />
									<circle cx={ex - 2.2} cy={ey + 3.6} r="1" fill="#ffffff" />
								{/if}
							</g>
							{#if !mark}
								<!-- eyelid: scales down for a blink, half-way for sleep -->
								<path
									class="lid"
									d="M{ex - 15} {ey} A15 15 0 0 1 {ex + 15} {ey} Z"
									fill={white ? '#ffffff' : shellLight}
									stroke={ink}
									stroke-width={sw}
									stroke-linejoin="round"
								/>
							{/if}
						</g>
					</g>
				{/each}

				<!-- the big claw (viewer's right): arm, palm, fixed finger and the hinged finger -->
				<g class="bigClaw" data-part="bigClaw">
					<!-- arm: merus + carpus -->
					<path
						d="M139 93 C147 92 153 88 157 81 L169 90 C163 101 152 107 141 107 Z"
						fill={shell}
						stroke={ink}
						stroke-width={sw}
						stroke-linejoin="round"
					/>
					<!-- fixed finger (pollex), pale like a real fiddler's, teeth on the inner edge -->
					<path
						d="M155 54 C141 36 145 4 172 -16 C168 4 172 22 179 36 C168 38 160 45 155 54 Z"
						fill={belly}
						stroke={ink}
						stroke-width={sw}
						stroke-linejoin="round"
					/>
					{#if !mark}<path
							d="M169 4 l5 0 M170 16 l5 0 M173 27 l4 0"
							stroke={ink}
							stroke-width="1.8"
							stroke-linecap="round"
						/>{/if}
					<g class="palm">
						<path
							transform={mark || white ? undefined : 'translate(1.8 1.8)'}
							d="M158 86 C148 74 150 54 160 44 C170 34 188 32 200 40 C212 48 212 70 204 84 C196 98 176 102 164 96 C161 94 159 90 158 86 Z"
							fill={shell}
						/>
						{#if !mark && !white}
							<path
								d="M158 86 C148 74 150 54 160 44 C170 34 188 32 200 40 C212 48 212 70 204 84 C196 98 176 102 164 96 C161 94 159 90 158 86 Z"
								fill="url(#g{uid})"
								opacity="0.25"
							/>
							<path
								d="M161 66 C162 54 170 45 182 42"
								fill="none"
								stroke={shellLight}
								stroke-width="4.5"
								stroke-linecap="round"
							/>
							<path
								d="M180 70 l2 0 M192 62 l2 1 M186 82 l2 0"
								stroke="#7a2a17"
								stroke-width="2.4"
								stroke-linecap="round"
							/>
						{/if}
						<path
							d="M158 86 C148 74 150 54 160 44 C170 34 188 32 200 40 C212 48 212 70 204 84 C196 98 176 102 164 96 C161 94 159 90 158 86 Z"
							fill="none"
							stroke={ink}
							stroke-width={sw}
							stroke-linejoin="round"
						/>
					</g>
					<!-- movable finger (dactyl), hinged at the top of the palm -->
					<g class="finger">
						<path
							d="M184 35 C187 18 187 -2 179 -21 C202 -14 213 12 207 46 C201 40 192 36 184 35 Z"
							fill={belly}
							stroke={ink}
							stroke-width={sw}
							stroke-linejoin="round"
						/>
						{#if !mark}<path
								d="M184 0 l-4 1 M186 12 l-4 1 M186 24 l-4 1"
								stroke={ink}
								stroke-width="1.8"
								stroke-linecap="round"
							/>{/if}
					</g>
					{#if hold && !mark}
						<g class="held">
							{#if hold === 'gem'}
								<path
									d="M159 -40 L177 -40 L184 -30 L168 -10 L152 -30 Z"
									fill="#c8d9e6"
									stroke={ink}
									stroke-width="2.6"
									stroke-linejoin="round"
								/>
								<path
									d="M152 -30 L184 -30 M164 -40 L161 -30 L168 -10 L175 -30 L172 -40"
									fill="none"
									stroke={ink}
									stroke-width="1.7"
									stroke-linejoin="round"
								/>
								<path
									class="spark"
									d="M190 -46 l0 8 M186 -42 l8 0"
									stroke="#b5462b"
									stroke-width="2.4"
									stroke-linecap="round"
								/>
							{:else if hold === 'leaf'}
								<path
									d="M156 -8 C150 -26 160 -42 184 -46 C188 -26 178 -10 156 -8 Z"
									fill="#4f8a55"
									stroke={ink}
									stroke-width="2.6"
									stroke-linejoin="round"
								/>
								<path
									d="M157 -9 C166 -20 174 -30 182 -42"
									fill="none"
									stroke={ink}
									stroke-width="1.7"
									stroke-linecap="round"
								/>
							{:else}
								<!-- a little one: the family pick -->
								<g transform="translate(140 -46) scale(.32)">
									<path
										d="M62 100 Q46 88 33 96 M66 116 Q50 117 42 130 M138 100 Q154 88 167 96 M134 116 Q150 117 158 130"
										fill="none"
										stroke={ink}
										stroke-width="9"
										stroke-linecap="round"
									/>
									<path
										d="M54 84 C54 74 62 69 73 69 L127 69 C138 69 146 74 146 84 C146 100 137 115 123 120 C110 125 90 125 77 120 C63 115 54 100 54 84 Z"
										fill="#d9785a"
										stroke={ink}
										stroke-width="7"
									/>
									<path
										d="M91 70 L86 40 M109 70 L114 40"
										stroke={ink}
										stroke-width="9"
										stroke-linecap="round"
									/>
									<circle cx="84" cy="32" r="14" fill="#fff" stroke={ink} stroke-width="7" />
									<circle cx="116" cy="32" r="14" fill="#fff" stroke={ink} stroke-width="7" />
									<circle cx="86" cy="34" r="7" fill={ink} />
									<circle cx="118" cy="34" r="7" fill={ink} />
								</g>
							{/if}
						</g>
					{/if}
				</g>

				{#if s === 'sleep' && !mark}
					<g class="zzz" fill={ink} font-family="Gloock, Georgia, serif">
						<text x="128" y="26" font-size="16">z</text>
						<text x="140" y="12" font-size="12">z</text>
					</g>
				{/if}
				{#if s === 'celebrate' && !mark}
					<g class="sparks" stroke="#b5462b" stroke-width="3" stroke-linecap="round">
						<path d="M206 4 l8 -6 M210 18 l10 0 M200 -8 l2 -9" />
					</g>
				{/if}
			</g>
		</g>
	</g>
</svg>

<style>
	.crabby {
		display: inline-block;
		flex: none;
		overflow: visible;
		--spd: 1;
	}
	.crabby :global(*) {
		transform-box: fill-box;
	}
	.pupil {
		transform: translate(var(--px), var(--py));
		transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.lid {
		transform-origin: 50% 0%;
		transform: scaleY(0);
		transition: transform 0.12s ease-out;
	}
	.blink .lid {
		transform: scaleY(1.9);
	}
	.leg {
		transform-origin: 100% 15%;
	}
	.leg4,
	.leg5,
	.leg6 {
		transform-origin: 0% 15%;
	}
	.bigClaw {
		transform-origin: 2% 88%;
		transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.finger {
		transform-origin: 60% 92%;
	}
	.smallClaw {
		transform-origin: 100% 0%;
	}
	.stalkL {
		transform-origin: 70% 100%;
		transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.stalkR {
		transform-origin: 30% 100%;
		transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.body,
	.hop {
		transform-origin: 50% 100%;
	}

	@media (prefers-reduced-motion: no-preference) {
		/* idle: breathing */
		.s-idle .body,
		.s-point .body,
		.s-think .body {
			animation: breathe 3.6s ease-in-out infinite;
		}
		.s-sleep .body {
			animation: breathe 5s ease-in-out infinite;
		}
		/* wave: the big claw swings from the shoulder, finger flicks */
		.s-wave .bigClaw {
			animation: wave 0.9s cubic-bezier(0.45, 0, 0.55, 1) 2;
		}
		.s-wave.loop .bigClaw {
			animation-iteration-count: infinite;
		}
		.s-wave .finger {
			animation: clack 0.45s ease-in-out 4;
		}
		/* scuttle: alternating leg groups, body bob */
		.s-scuttle .la {
			animation: legA calc(0.34s * var(--spd)) ease-in-out infinite alternate;
		}
		.s-scuttle .lb {
			animation: legA calc(0.34s * var(--spd)) ease-in-out infinite alternate-reverse;
		}
		.s-scuttle .hop {
			animation: bob calc(0.17s * var(--spd)) ease-in-out infinite alternate;
		}
		.s-scuttle .bigClaw {
			animation: sway calc(0.68s * var(--spd)) ease-in-out infinite alternate;
		}
		/* think: the small claw taps */
		.s-think .smallClaw {
			animation: tap 0.6s ease-in-out infinite;
		}
		/* celebrate: hop + claw clack */
		.s-celebrate .hop {
			animation: hop 0.7s cubic-bezier(0.3, 0, 0.3, 1) 3;
		}
		.s-celebrate.loop .hop,
		.s-celebrate.loop .finger {
			animation-iteration-count: infinite;
		}
		.s-celebrate .finger {
			animation: clack 0.35s ease-in-out 6;
		}
		.s-celebrate .sparks,
		.s-sleep .zzz,
		.held .spark {
			animation: float 1.8s ease-in-out infinite;
		}
		.held {
			animation: pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
			transform-origin: 50% 100%;
		}
	}
	/* poses (hold under reduced motion too) */
	.s-point .bigClaw {
		transform: rotate(34deg) translate(6px, -2px);
	}
	.s-point .finger {
		transform: rotate(12deg);
	}
	.s-celebrate .smallClaw {
		transform: rotate(-40deg);
	}
	.s-sleep .lid {
		transform: scaleY(1.25);
	}
	.s-sleep .stalkL {
		transform: rotate(-16deg);
	}
	.s-sleep .stalkR {
		transform: rotate(16deg);
	}
	.s-sleep .bigClaw {
		transform: rotate(14deg) translate(-2px, 6px);
	}
	.s-think .stalkL {
		transform: rotate(-6deg);
	}
	.s-think .stalkR {
		transform: rotate(4deg);
	}
	.mark .shadow {
		display: none;
	}

	@keyframes breathe {
		50% {
			transform: scaleY(1.035) translateY(-0.6px);
		}
	}
	@keyframes wave {
		0%,
		100% {
			transform: rotate(0deg);
		}
		30% {
			transform: rotate(-26deg);
		}
		65% {
			transform: rotate(10deg);
		}
	}
	@keyframes clack {
		50% {
			transform: rotate(18deg);
		}
	}
	@keyframes legA {
		from {
			transform: rotate(-13deg);
		}
		to {
			transform: rotate(11deg);
		}
	}
	@keyframes bob {
		to {
			transform: translateY(-2.5px);
		}
	}
	@keyframes sway {
		to {
			transform: rotate(-7deg);
		}
	}
	@keyframes tap {
		0%,
		100% {
			transform: rotate(0deg);
		}
		40% {
			transform: rotate(-22deg);
		}
		60% {
			transform: rotate(-4deg);
		}
	}
	@keyframes hop {
		0%,
		100% {
			transform: translateY(0) scale(1, 1);
		}
		15% {
			transform: translateY(0) scale(1.06, 0.92);
		}
		45% {
			transform: translateY(-18px) scale(0.97, 1.04);
		}
		75% {
			transform: translateY(0) scale(1.04, 0.95);
		}
	}
	@keyframes float {
		50% {
			transform: translateY(-5px);
			opacity: 0.6;
		}
	}
	@keyframes pop {
		from {
			transform: scale(0);
		}
	}
</style>
