<script module lang="ts">
	export type SceneKey = 'dawn' | 'lane' | 'fort' | 'falls' | 'market' | 'golden';
	export const SCENES: SceneKey[] = ['dawn', 'lane', 'fort', 'falls', 'market', 'golden'];
</script>

<script lang="ts">
	// One continuous coast for onboarding (brief §8): each step has its own place, and moving between steps
	// crossfades while every layer slides at its own depth, sideways like a crab. Scenes in step order.
	let { scene }: { scene: SceneKey } = $props();
	const at = $derived(SCENES.indexOf(scene));

	const SKY: Record<SceneKey, [string, string]> = {
		dawn: ['#a9c2d4', '#f3d9c9'],
		lane: ['#c8d9e6', '#eef3f6'],
		fort: ['#b7cfdf', '#e4eef4'],
		falls: ['#c8d9e6', '#dfeaf1'],
		market: ['#4f6a85', '#e9b58f'],
		golden: ['#c8d9e6', '#f2cfae']
	};
</script>

<div class="scenes" aria-hidden="true">
	{#each SCENES as k, i (k)}
		<div
			class={['scene', i === at && 'cur']}
			style:--dir={Math.sign(i - at)}
			style:--sky-a={SKY[k][0]}
			style:--sky-b={SKY[k][1]}
		>
			<svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMax slice">
				<g class="l" style:--d="0.2">
					{#if k === 'market'}
						<circle cx="610" cy="150" r="40" fill="#f6dcb8" />
						<g fill="#f5efeb"
							><circle cx="120" cy="80" r="1.6" /><circle cx="300" cy="50" r="1.2" /><circle
								cx="470"
								cy="96"
								r="1.4"
							/><circle cx="700" cy="60" r="1.2" /></g
						>
					{:else}
						<circle
							cx={k === 'dawn' ? 430 : k === 'golden' ? 400 : 560}
							cy={k === 'dawn' ? 270 : k === 'golden' ? 250 : 130}
							r={k === 'golden' ? 70 : 46}
							fill="#f5efeb"
						/>
						<circle
							cx={k === 'dawn' ? 433 : k === 'golden' ? 403 : 563}
							cy={k === 'dawn' ? 273 : k === 'golden' ? 253 : 133}
							r={k === 'golden' ? 70 : 46}
							fill="none"
							stroke="#b5462b"
							stroke-width="1.4"
							opacity=".3"
						/>
						<g
							fill="none"
							stroke="#2f4156"
							stroke-width="2"
							stroke-linecap="round"
							opacity=".6"
							class="gulls"
						>
							<path d="M250 170 q8 -8 16 0 q8 -8 16 0" />
							<path d="M300 140 q6 -6 12 0 q6 -6 12 0" />
							<path d="M200 230 c14 -8 34 -8 48 0 M218 242 c10 -5 24 -5 34 0" opacity=".5" />
						</g>
					{/if}
				</g>

				{#if k === 'dawn' || k === 'golden'}
					<g class="l" style:--d="0.35">
						<path
							d="M0 330 C120 300 220 318 330 300 S560 290 800 316 L800 600 L0 600 Z"
							fill={k === 'dawn' ? '#b9c9d6' : '#b3b9c4'}
						/>
					</g>
					<g class="l" style:--d="0.55">
						<rect y="350" width="800" height="250" fill={k === 'dawn' ? '#5d8396' : '#4f7385'} />
						<g fill="none" stroke="#c8d9e6" stroke-linecap="round" class="waves">
							<path
								d="M-80 372 q40 -8 80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0"
								stroke-width="2"
								opacity=".5"
							/>
							<path
								d="M-120 410 q60 -10 120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0"
								stroke-width="2"
								opacity=".3"
							/>
						</g>
						<path
							d="M520 350 h80"
							stroke="#f6dcb8"
							stroke-width="3"
							stroke-linecap="round"
							opacity=".7"
						/>
						<g transform="translate(590 296)">
							<path
								d="M-8 52 L-5 0 L5 0 L8 52 Z"
								fill="#f5efeb"
								stroke="#2f4156"
								stroke-width="2"
							/>
							<path d="M-7 18 h14 M-6.4 36 h12.8" stroke="#2f4156" stroke-width="5" />
							<rect
								x="-6"
								y="-12"
								width="12"
								height="12"
								fill="#c8d9e6"
								stroke="#2f4156"
								stroke-width="2"
							/>
							<path d="M-8 -12 L0 -20 L8 -12 Z" fill="#b5462b" />
						</g>
					</g>
					<g class="l" style:--d="0.9">
						<path
							d="M0 600 L0 480 C140 456 300 470 420 500 C520 524 640 540 800 530 L800 600 Z"
							fill="#efe2d6"
						/>
						<path
							d="M0 480 C140 456 300 470 420 500 C520 524 640 540 800 530"
							fill="none"
							stroke="#2f4156"
							stroke-width="2"
						/>
						<g transform="translate(70 0)">
							<path
								d="M120 500 C116 450 124 400 142 356 L148 358 C132 402 126 452 130 500 Z"
								fill="#2f4156"
							/>
							<path
								d="M145 356 C118 338 88 342 64 360 C92 352 118 352 145 360 Z M145 356 C152 330 176 318 204 320 C180 330 162 342 147 360 Z M145 356 C130 330 106 322 82 326 C106 336 126 346 144 360 Z M145 356 C172 346 198 354 216 374 C192 364 168 362 147 360 Z"
								fill="#2f4156"
							/>
						</g>
					</g>
				{:else if k === 'lane'}
					<g class="l" style:--d="0.35">
						<path
							d="M0 300 C140 270 260 290 400 276 S640 262 800 284 L800 600 L0 600 Z"
							fill="#a9c2d4"
						/>
					</g>
					<g class="l" style:--d="0.55">
						<!-- the lane: red earth narrowing into the village -->
						<path
							d="M300 600 C340 500 380 420 396 340 L420 340 C436 420 480 500 560 600 Z"
							fill="#c98b72"
						/>
						<path
							d="M330 560 l10 -6 M380 470 l8 -4 M420 520 l10 6 M470 560 l12 6"
							stroke="#9c4a33"
							stroke-width="2"
							stroke-linecap="round"
						/>
						<g stroke="#2f4156" stroke-width="2.4" stroke-linejoin="round">
							<path d="M40 380 L150 300 L260 380 Z" fill="#b5462b" />
							<path d="M56 380 H244 V490 H56 Z" fill="#f5efeb" />
							<path d="M130 490 V430 H170 V490" fill="#2f4156" />
							<path d="M80 410 h26 v26 h-26 z M196 410 h26 v26 h-26 z" fill="#c8d9e6" />
							<path d="M560 360 L650 296 L740 360 Z" fill="#9c4a33" />
							<path d="M572 360 H728 V460 H572 Z" fill="#efe2d6" />
							<path d="M636 460 V408 H668 V460" fill="#2f4156" />
						</g>
						<path d="M84 340 h132 M600 334 h104" stroke="#2f4156" stroke-width="1.4" />
						<!-- tulsi vrindavan -->
						<g transform="translate(300 470)" stroke="#2f4156" stroke-width="2">
							<path d="M-18 40 V0 H18 V40 Z" fill="#f5efeb" />
							<path d="M-22 0 H22" />
							<path
								d="M0 0 C-6 -16 -16 -22 -22 -24 M0 0 C4 -18 14 -24 20 -26 M0 0 V-30"
								fill="none"
								stroke="#4f8a55"
								stroke-width="3"
								stroke-linecap="round"
							/>
						</g>
					</g>
					<g class="l" style:--d="0.9">
						<path
							d="M760 600 C756 520 766 440 786 380 L792 382 C774 442 766 522 770 600 Z"
							fill="#2f4156"
						/>
						<path
							d="M789 380 C764 362 734 366 712 384 C740 376 766 376 789 384 Z M789 380 C796 354 820 342 846 344 C822 354 804 366 791 384 Z"
							fill="#2f4156"
						/>
						<path d="M0 600 L0 540 C60 534 100 560 120 600 Z" fill="#2f4156" />
					</g>
				{:else if k === 'fort'}
					<g class="l" style:--d="0.35">
						<path
							d="M0 320 C160 296 300 314 440 300 S700 290 800 300 L800 600 L0 600 Z"
							fill="#a9c2d4"
						/>
					</g>
					<g class="l" style:--d="0.55">
						<rect y="380" width="800" height="220" fill="#567c8d" />
						<path
							d="M-60 400 q40 -8 80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0"
							fill="none"
							stroke="#c8d9e6"
							stroke-width="2"
							opacity=".5"
							class="waves"
						/>
					</g>
					<g class="l" style:--d="0.75">
						<!-- Ratnadurg: cliff, bastions, flag -->
						<path
							d="M200 600 C230 520 270 460 330 420 C390 384 470 372 560 380 C640 388 720 410 800 440 L800 600 Z"
							fill="#2f4156"
						/>
						<path
							d="M300 430 L300 380 L330 380 L330 366 L352 366 L352 380 L400 380 L400 360 L424 360 L424 380 L470 380 L470 352 C500 336 540 330 580 334 L580 360 L604 360 L604 346 L626 346 L626 362 L660 370"
							fill="none"
							stroke="#2f4156"
							stroke-width="10"
							stroke-linejoin="round"
						/>
						<path d="M300 380 L300 430 M470 352 L470 380" stroke="#2f4156" stroke-width="10" />
						<path d="M520 334 V280" stroke="#2f4156" stroke-width="3" />
						<path d="M522 282 L556 292 L522 304 Z" fill="#b5462b" class="flag" />
						<path
							d="M330 440 C380 420 440 414 500 416"
							fill="none"
							stroke="#3d5570"
							stroke-width="2"
						/>
					</g>
				{:else if k === 'falls'}
					<g class="l" style:--d="0.35">
						<path
							d="M0 260 C120 190 220 240 330 190 C420 150 520 200 800 170 L800 600 L0 600 Z"
							fill="#6f8fa3"
						/>
						<path
							d="M330 210 C338 300 332 380 340 470 L388 470 C380 380 386 300 378 206 Z"
							fill="#e4eef4"
						/>
						<g stroke="#a9c2d4" stroke-width="3" stroke-linecap="round" class="fall">
							<path d="M344 230 v60 M356 260 v70 M366 230 v40 M350 340 v60 M370 330 v70" />
						</g>
					</g>
					<g class="l" style:--d="0.55">
						<path
							d="M0 470 C120 440 240 486 360 474 S620 440 800 462 L800 600 L0 600 Z"
							fill="#567c8d"
						/>
						<ellipse cx="362" cy="474" rx="70" ry="14" fill="#e4eef4" opacity=".7" />
					</g>
					<g class="l" style:--d="0.9">
						<!-- mango orchard in front -->
						<g transform="translate(90 0)">
							<g fill="#2f4156">
								<path d="M80 600 V520 h12 V600 Z M550 600 V500 h12 V600 Z" />
								<path
									d="M86 530 c-60 0 -80 -40 -70 -70 c8 -30 40 -44 70 -44 s62 14 70 44 c10 30 -10 70 -70 70z"
								/>
								<path
									d="M646 514 c-70 0 -96 -46 -84 -80 c10 -36 48 -52 84 -52 s74 16 84 52 c12 34 -14 80 -84 80z"
								/>
							</g>
							<g fill="#e8a33d" stroke="#2f4156" stroke-width="1.6">
								<ellipse cx="60" cy="490" rx="7" ry="9" /><ellipse
									cx="112"
									cy="478"
									rx="7"
									ry="9"
								/><ellipse cx="620" cy="470" rx="7" ry="9" /><ellipse
									cx="680"
									cy="454"
									rx="7"
									ry="9"
								/><ellipse cx="652" cy="488" rx="7" ry="9" />
							</g>
						</g>
					</g>
				{:else if k === 'market'}
					<g class="l" style:--d="0.35">
						<path d="M0 340 C200 320 400 336 800 320 L800 600 L0 600 Z" fill="#3d5570" />
					</g>
					<g class="l" style:--d="0.6">
						<!-- stalls with striped awnings and lanterns -->
						{#each [60, 290, 520] as x, i (x)}
							<g
								transform="translate({x} 330)"
								stroke="#2f4156"
								stroke-width="2.4"
								stroke-linejoin="round"
							>
								<path d="M0 40 L20 0 H200 L220 40 Z" fill={i === 1 ? '#b5462b' : '#f5efeb'} />
								<path d="M44 0 L36 40 M88 0 L84 40 M132 0 L136 40 M176 0 L184 40" fill="none" />
								<path d="M10 40 V150 H210 V40" fill="#2f4156" />
								<path d="M24 120 h172" stroke="#f5efeb" stroke-width="2" />
								<g fill="#e8a33d"
									><circle cx="50" cy="108" r="9" /><circle cx="70" cy="110" r="9" /><circle
										cx="150"
										cy="106"
										r="8"
									/><circle cx="170" cy="108" r="9" /></g
								>
								<path d="M110 0 V-20" />
								<circle cx="110" cy="-28" r="9" fill="#f6dcb8" class="lantern" />
							</g>
						{/each}
					</g>
					<g class="l" style:--d="0.95">
						<!-- the thali -->
						<path d="M0 600 L0 520 C200 500 600 500 800 520 L800 600 Z" fill="#22303f" />
						<g transform="translate(400 540)">
							<ellipse rx="150" ry="44" fill="#c8d9e6" stroke="#2f4156" stroke-width="3" />
							<ellipse
								rx="128"
								ry="34"
								fill="none"
								stroke="#2f4156"
								stroke-width="1.6"
								opacity=".5"
							/>
							<g stroke="#2f4156" stroke-width="2.4">
								<ellipse cx="-76" cy="-6" rx="26" ry="10" fill="#e8a33d" />
								<ellipse cx="-24" cy="-14" rx="24" ry="9" fill="#d9785a" />
								<ellipse cx="28" cy="-14" rx="24" ry="9" fill="#f5efeb" />
								<ellipse cx="78" cy="-6" rx="26" ry="10" fill="#c98b72" />
							</g>
							<path
								d="M-60 16 c20 10 100 10 120 0"
								fill="#f5efeb"
								stroke="#2f4156"
								stroke-width="2.4"
							/>
							<path
								d="M-30 -30 c-4 -10 4 -14 0 -24 M10 -34 c-4 -10 4 -14 0 -24"
								fill="none"
								stroke="#f5efeb"
								stroke-width="2"
								stroke-linecap="round"
								class="steam"
							/>
						</g>
					</g>
				{/if}
			</svg>
		</div>
	{/each}
</div>

<style>
	.scenes {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}
	.scene {
		position: absolute;
		inset: 0;
		opacity: 0;
		background: linear-gradient(to bottom, var(--sky-a), var(--sky-b) 75%);
		transition: opacity 0.8s var(--j-ease);
	}
	.scene.cur {
		opacity: 1;
	}
	svg {
		position: absolute;
		inset: 0 -60px;
		width: calc(100% + 120px);
		height: 100%;
	}
	.l {
		transform: translateX(calc(var(--dir) * var(--d) * 140px));
		transition: transform 1s var(--j-ease-out);
	}
	.cur .l {
		transform: none;
	}
	@media (prefers-reduced-motion: no-preference) {
		.waves {
			animation: drift 9s linear infinite;
		}
		.fall {
			animation: fall 1.1s linear infinite;
		}
		.lantern {
			animation: glow 2.4s ease-in-out infinite;
		}
		.steam {
			animation: steam 2.6s ease-in-out infinite;
		}
		.gulls {
			animation: gulls 12s ease-in-out infinite;
		}
		.flag {
			transform-box: fill-box;
			transform-origin: 0 50%;
			animation: flag 1.6s ease-in-out infinite;
		}
	}
	@keyframes drift {
		to {
			transform: translateX(80px);
		}
	}
	@keyframes fall {
		to {
			transform: translateY(16px);
			opacity: 0.4;
		}
	}
	@keyframes glow {
		50% {
			opacity: 0.55;
		}
	}
	@keyframes steam {
		50% {
			transform: translateY(-6px);
			opacity: 0.3;
		}
	}
	@keyframes gulls {
		50% {
			transform: translate(30px, -10px);
		}
	}
	@keyframes flag {
		50% {
			transform: scaleX(0.8) skewY(4deg);
		}
	}
</style>
