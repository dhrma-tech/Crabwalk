<script module lang="ts">
	// Deterministic star field (same on server and client).
	let seed = 7;
	const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
	export const STARS = Array.from({ length: 46 }, () => ({
		x: Math.round(rnd() * 1440),
		y: Math.round(rnd() * 260),
		r: +(0.6 + rnd() * 1.4).toFixed(1),
		d: +(rnd() * 4).toFixed(2)
	}));
</script>

<script lang="ts">
	import type { Sky } from '../sky.ts';

	// Living coast (brief §7.1): stacked cut-paper layers that move at different speeds with the pointer and the
	// scroll (CSS vars --mx, --my, --sy set by the hero). Pure SVG + CSS; low-end phones drop two layers.
	let { sky }: { sky: Sky } = $props();
	const night = $derived(sky.phase === 'night');
	// Wave line: one long sine, drawn twice the width so it can loop sideways.
	const wave = (y: number, amp: number, len: number) => {
		let d = `M-${len * 2} ${y}`;
		for (let x = -len * 2; x < 1440 + len * 2; x += len) d += ` q${len / 4} ${-amp} ${len / 2} 0 t${len / 2} 0`;
		return d;
	};
</script>

<div
	class="diorama"
	style:--sky-top={sky.top}
	style:--sky-bottom={sky.bottom}
	style:--sea={sky.sea}
	style:--hill1={sky.hills[0]}
	style:--hill2={sky.hills[1]}
	style:--sun={sky.sun}
	style:--glow={sky.glow}
	aria-hidden="true"
>
	<!-- 1 · sky: sun or moon on its arc (IST), stars at night, gulls by day -->
	<div class="layer sky" style:--d="0.05">
		{#if night}
			<svg class="stars" viewBox="0 0 1440 300" preserveAspectRatio="xMidYMin slice">
				{#each STARS as s, i (i)}
					<circle cx={s.x} cy={s.y} r={s.r} fill="#f5efeb" style:animation-delay="{s.d}s" />
				{/each}
			</svg>
		{/if}
		<div class={['sun', night && 'moon']} style:left="{6 + sky.x * 88}%" style:top="{14 + sky.y * 40}%"></div>
		{#if !night}
			<svg class="gulls" viewBox="0 0 100 40" fill="none" stroke="#2f4156" stroke-width="2" stroke-linecap="round">
				<path d="M10 24 q8 -8 16 0 q8 -8 16 0" />
				<path d="M60 10 q6 -6 12 0 q6 -6 12 0" />
			</svg>
		{/if}
	</div>

	<div class="land">
	<!-- 2 · far hills: the Sahyadri, misty, with ridge hatching -->
	<div class="layer far" style:--d="0.15">
		<svg viewBox="0 0 1440 560" preserveAspectRatio="xMidYMax slice">
			<path
				d="M0 318 C90 280 170 262 250 270 C320 276 360 236 430 228 C520 218 560 262 650 254 C740 246 790 206 880 200 C960 194 1010 236 1090 230 C1170 224 1230 192 1310 198 C1370 202 1410 214 1440 220 L1440 560 L0 560 Z"
				fill="var(--hill1)"
			/>
			<g fill="none" stroke="#2f4156" stroke-width="1.4" stroke-linecap="round" opacity=".28">
				<path d="M430 228 c-14 18 -20 30 -40 44 M444 232 c-8 14 -10 24 -22 36" />
				<path d="M880 200 c-16 22 -24 34 -48 48 M896 204 c-10 18 -14 28 -30 40 M910 208 c-6 12 -8 20 -18 30" />
				<path d="M1310 198 c-12 16 -18 26 -36 38 M1324 202 c-8 12 -10 20 -22 30" />
			</g>
		</svg>
	</div>

	<!-- 3 · near headlands: laterite cliffs and mango clumps -->
	<div class="layer near" style:--d="0.3">
		<svg viewBox="0 0 1440 560" preserveAspectRatio="xMidYMax slice">
			<defs>
				<pattern id="dio-riso" width="7" height="7" patternUnits="userSpaceOnUse">
					<circle cx="1.5" cy="1.5" r=".8" fill="#2f4156" />
					<circle cx="5" cy="4.6" r=".6" fill="#2f4156" />
				</pattern>
			</defs>
			<path
				d="M0 330 C70 300 160 288 250 300 C320 310 370 330 420 360 L420 560 L0 560 Z"
				fill="var(--hill2)"
			/>
			<path
				d="M0 330 C70 300 160 288 250 300 C320 310 370 330 420 360 L420 560 L0 560 Z"
				fill="#2f4156"
				opacity=".22"
			/>
			<path
				d="M0 330 C70 300 160 288 250 300 C320 310 370 330 420 360 L420 560 L0 560 Z"
				fill="url(#dio-riso)"
				opacity=".12"
			/>
			<!-- red-earth cliff face -->
			<path d="M380 338 C396 350 410 356 420 362 L420 392 C404 384 392 372 380 360 Z" fill="#b5462b" opacity=".55" />
			<g stroke="#2f4156" stroke-width="1.3" stroke-linecap="round" opacity=".45">
				<path d="M388 346 l-2 14 M398 352 l-2 16 M408 357 l-1 16" />
			</g>
			<path
				d="M600 360 C660 330 760 322 850 336 C900 344 930 354 960 366 L600 366 Z"
				fill="var(--hill2)"
			/>
			<!-- mango and cashew clumps -->
			<g fill="#2f4156" opacity=".42">
				<path d="M70 304 c-6 -16 10 -28 22 -20 c8 -12 28 -6 26 8 c12 2 12 18 0 20 Z" />
				<path d="M168 292 c-4 -12 8 -22 18 -16 c6 -10 22 -4 20 6 c10 2 10 14 0 16 Z" />
			</g>
		</svg>
	</div>

	<!-- 4 · the sea: moving wave lines, a fishing boat bobbing -->
	<div class="layer sea" style:--d="0.42">
		<svg viewBox="0 0 1440 560" preserveAspectRatio="xMidYMax slice">
			<rect x="-200" y="356" width="1840" height="240" fill="var(--sea)" />
			<g fill="none" stroke="#c8d9e6" stroke-linecap="round">
				<path class="wl w1" d={wave(372, 5, 90)} stroke-width="2" opacity=".55" />
				<path class="wl w2" d={wave(404, 6, 120)} stroke-width="2" opacity=".35" />
				<path class="wl w3" d={wave(446, 7, 150)} stroke-width="2.4" opacity=".28" />
				<path class="wl w4" d={wave(500, 8, 190)} stroke-width="2.6" opacity=".2" />
			</g>
			<!-- glints -->
			<g stroke="#f5efeb" stroke-width="2" stroke-linecap="round" class="glint">
				<path d="M560 386 h18 M610 396 h10 M1010 392 h14 M960 420 h22" />
			</g>
			<!-- hodi (fishing boat) -->
			<g class="boat" transform="translate(1000 392)">
				<path d="M-46 0 C-30 14 30 14 50 0 L44 -4 L-40 -4 Z" fill="#2f4156" />
				<path d="M-36 -4 L-30 -10 L36 -10 L42 -4" fill="none" stroke="#2f4156" stroke-width="2" />
				<path d="M2 -10 L2 -64" stroke="#2f4156" stroke-width="2.4" stroke-linecap="round" />
				<path d="M4 -62 C24 -48 30 -30 28 -12 L4 -12 Z" fill="#f5efeb" stroke="#2f4156" stroke-width="2" stroke-linejoin="round" />
				<path d="M-40 6 C-26 14 24 14 44 6" fill="none" stroke="#c8d9e6" stroke-width="1.6" opacity=".6" />
			</g>
		</svg>
	</div>

	<!-- 5 · Ratnadurg: cliff, fort wall and the lighthouse -->
	<div class="layer cliff" style:--d="0.6">
		<svg viewBox="0 0 1440 560" preserveAspectRatio="xMaxYMax slice">
			{#if night}
				<g class="beam" transform="translate(1330 178)">
					<defs>
						<linearGradient id="dio-beam" x1="0" x2="1">
							<stop offset="0" stop-color="#f6e3b4" stop-opacity=".55" />
							<stop offset="1" stop-color="#f6e3b4" stop-opacity="0" />
						</linearGradient>
					</defs>
					<path class="cone" d="M0 0 L-900 -70 L-900 60 Z" fill="url(#dio-beam)" />
				</g>
			{/if}
			<path
				d="M1440 214 C1408 216 1376 232 1340 250 C1300 270 1268 300 1228 330 C1196 356 1170 392 1150 430 C1132 466 1120 512 1112 560 L1440 560 Z"
				fill="#2f4156"
			/>
			<!-- fort wall with bastions along the cliff top -->
			<path
				d="M1186 344 L1186 326 L1196 326 L1196 318 L1206 318 L1206 326 L1222 326 L1222 310 C1236 300 1252 290 1268 284 L1268 270 L1278 270 L1278 262 L1290 262 L1290 270 L1300 270 L1300 258 C1316 248 1330 244 1350 240"
				fill="none"
				stroke="#2f4156"
				stroke-width="6"
				stroke-linejoin="round"
			/>
			<path d="M1160 400 C1190 380 1220 372 1250 368" fill="none" stroke="#3d5570" stroke-width="2" />
			<path d="M1140 470 C1180 450 1220 446 1270 440" fill="none" stroke="#3d5570" stroke-width="2" />
			<!-- lighthouse -->
			<g transform="translate(1330 0)">
				<path d="M-14 236 L-10 168 L10 168 L14 236 Z" fill="#f5efeb" stroke="#2f4156" stroke-width="2.4" stroke-linejoin="round" />
				<path d="M-12.6 214 L12.6 214 L13.4 226 L-13.4 226 Z M-11.2 190 L11.2 190 L11.8 200 L-11.8 200 Z" fill="#2f4156" />
				<path d="M-18 168 L18 168 M-16 162 L16 162" stroke="#2f4156" stroke-width="3" />
				<rect x="-9" y="146" width="18" height="16" fill={night ? '#f6e3b4' : '#c8d9e6'} stroke="#2f4156" stroke-width="2.4" />
				<path d="M-12 146 L0 134 L12 146 Z" fill="#b5462b" stroke="#2f4156" stroke-width="2.2" stroke-linejoin="round" />
				<path d="M0 134 L0 126" stroke="#2f4156" stroke-width="2" />
			</g>
		</svg>
	</div>

	<!-- 6 · foreground: rocks, coconut palms -->
	<div class="layer front" style:--d="0.95">
		<svg viewBox="0 0 1440 560" preserveAspectRatio="xMinYMax slice">
			<path
				d="M0 560 L0 438 C40 432 80 446 112 470 C140 490 170 500 210 506 C250 512 280 530 300 560 Z"
				fill="#22303f"
			/>
			<g fill="none" stroke="#3d5570" stroke-width="2" stroke-linecap="round">
				<path d="M40 470 c20 4 36 14 50 28 M130 500 c18 2 40 10 56 22" />
			</g>
			<!-- palms: trunks as tapered ink strokes, fronds as cut shapes -->
			<g class="palm p1">
				<path d="M96 470 C92 420 96 370 114 318 L120 320 C104 372 102 422 106 470 Z" fill="#22303f" />
				<g fill="#22303f">
					<path d="M117 318 C90 300 60 304 36 322 C64 314 90 314 117 322 Z" />
					<path d="M117 318 C100 290 72 280 46 284 C74 292 96 302 116 322 Z" />
					<path d="M117 318 C126 290 150 276 178 276 C152 288 134 302 120 322 Z" />
					<path d="M117 318 C144 306 172 310 196 330 C168 320 144 318 120 322 Z" />
					<path d="M117 318 C112 300 116 282 128 268 C124 286 122 302 121 320 Z" />
				</g>
			</g>
			<g class="palm p2">
				<path d="M196 498 C200 456 214 416 240 378 L245 381 C222 420 210 458 206 498 Z" fill="#22303f" />
				<g fill="#22303f">
					<path d="M243 378 C222 362 196 364 176 378 C200 372 222 372 243 382 Z" />
					<path d="M243 378 C236 354 216 342 194 342 C216 352 232 364 241 382 Z" />
					<path d="M243 378 C254 356 274 346 296 348 C274 356 258 366 246 382 Z" />
					<path d="M243 378 C264 370 286 376 302 392 C280 384 262 382 246 382 Z" />
				</g>
			</g>
			<path d="M1260 560 C1290 520 1340 508 1400 516 L1440 520 L1440 560 Z" fill="#22303f" />
		</svg>
	</div>
	</div>
</div>

<style>
	.diorama {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: linear-gradient(to bottom, var(--sky-top), var(--sky-bottom) 70%);
		transition: background 1.2s;
		--mx: 0;
		--my: 0;
		--sy: 0;
	}
	.layer {
		position: absolute;
		inset: -24px -40px 0;
		will-change: transform;
		transform: translate3d(
			calc(var(--mx) * var(--d) * -36px),
			calc(var(--my) * var(--d) * -14px + var(--sy) * var(--d) * 0.32px),
			0
		);
	}
	.land .layer svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.land {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 56%;
	}
	.sky {
		inset: -24px -40px 0;
	}
	.sky .stars {
		position: absolute;
		inset: 0 0 auto;
		width: 100%;
		height: 55%;
	}
	.sun {
		position: absolute;
		width: clamp(70px, 8vw, 116px);
		aspect-ratio: 1;
		border-radius: 50%;
		translate: -50% -50%;
		background: var(--sun);
		box-shadow:
			0 0 0 clamp(30px, 4vw, 60px) color-mix(in srgb, var(--glow) 22%, transparent),
			0 0 120px 60px color-mix(in srgb, var(--glow) 30%, transparent);
		transition:
			left 2s var(--j-ease),
			top 2s var(--j-ease),
			background 1.2s;
	}
	/* riso misregistration: a laterite ring a hair off the sun */
	.sun::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 50%;
		border: 1.5px solid rgb(181 70 43 / 0.35);
		translate: 3px 2px;
	}
	.moon {
		background: radial-gradient(circle at 70% 35%, var(--sky-top) 46%, var(--sun) 47%);
		box-shadow: 0 0 80px 30px rgb(200 217 230 / 0.12);
	}
	.moon::after {
		display: none;
	}
	.gulls {
		position: absolute;
		left: 26%;
		top: 22%;
		width: clamp(60px, 7vw, 100px);
	}
	@media (max-width: 720px) {
		.land {
			height: 48%;
		}
	}
	.front {
		inset: -24px -60px -10px;
	}
	:global(html[data-lite]) .far,
	:global(html[data-lite]) .front .palm {
		display: none;
	}
	@media (prefers-reduced-motion: no-preference) {
		.wl {
			animation: drift linear infinite;
		}
		.w1 {
			animation-duration: 9s;
			--len: 90px;
		}
		.w2 {
			animation-duration: 13s;
			animation-direction: reverse;
			--len: 120px;
		}
		.w3 {
			animation-duration: 17s;
			--len: 150px;
		}
		.w4 {
			animation-duration: 23s;
			animation-direction: reverse;
			--len: 190px;
		}
		.boat {
			animation: bob 4.2s ease-in-out infinite;
		}
		.glint {
			animation: glint 3s ease-in-out infinite;
		}
		.stars circle {
			transform-box: fill-box;
			animation: twinkle 3.6s ease-in-out infinite;
		}
		.beam .cone {
			transform-box: view-box;
			transform-origin: 0 0;
			animation: sweep 9s ease-in-out infinite;
		}
		.palm {
			transform-box: fill-box;
			transform-origin: 30% 100%;
			animation: sway 7s ease-in-out infinite;
		}
		.p2 {
			animation-duration: 8.5s;
			animation-delay: -2s;
		}
		.gulls {
			animation: gulls 14s ease-in-out infinite;
		}
	}
	:global(html[data-lite]) .wl,
	:global(html[data-lite]) .stars circle,
	:global(html[data-lite]) .palm {
		animation: none;
	}
	@keyframes drift {
		to {
			transform: translateX(var(--len));
		}
	}
	@keyframes bob {
		0%,
		100% {
			transform: translate(1000px, 392px) rotate(-1.5deg);
		}
		50% {
			transform: translate(1000px, 396px) rotate(1.5deg);
		}
	}
	@keyframes glint {
		50% {
			opacity: 0.2;
		}
	}
	@keyframes twinkle {
		50% {
			opacity: 0.25;
		}
	}
	@keyframes sweep {
		0%,
		100% {
			transform: rotate(-14deg) scaleX(0.55);
			opacity: 0.3;
		}
		50% {
			transform: rotate(12deg) scaleX(1);
			opacity: 1;
		}
	}
	@keyframes sway {
		50% {
			transform: rotate(1.6deg);
		}
	}
	@keyframes gulls {
		50% {
			transform: translate(40px, -12px);
		}
	}
</style>
