<script lang="ts">
	// Placeholder art for a gem card until real photos arrive (brief §7.4), in the field-journal style: flat riso
	// fills, navy ink, one laterite note. Layers shift by `--shift` (−1 … 1) for the card's own parallax.
	let { scene, tone = 0 }: { scene: 'cove' | 'cliff' | 'falls' | 'village'; tone?: number } =
		$props();
	const SKY = ['#c8d9e6', '#a9c2d4', '#d5e2ec'];
	const sky = $derived(SKY[tone % SKY.length]);
</script>

<svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" class="scene">
	<rect width="300" height="400" fill={sky} />
	<g class="l0">
		<circle cx={scene === 'falls' ? 76 : 218} cy="112" r="28" fill="#f5efeb" />
		<circle
			cx={scene === 'falls' ? 78 : 220}
			cy="114"
			r="28"
			fill="none"
			stroke="#b5462b"
			stroke-width="1.2"
			opacity=".35"
		/>
		<g fill="none" stroke="#2f4156" stroke-width="1.6" stroke-linecap="round" opacity=".55">
			<path d="M40 150 q6 -6 12 0 q6 -6 12 0 M70 136 q5 -5 10 0 q5 -5 10 0" />
			<path d="M150 70 c10 -6 24 -6 34 0 M164 80 c8 -4 18 -4 26 0" opacity=".6" />
		</g>
	</g>
	{#if scene === 'cove'}
		<g class="l1">
			<path
				d="M-20 210 C40 180 100 196 160 178 S260 170 330 186 L330 400 L-20 400 Z"
				fill="#8aa7b9"
			/>
		</g>
		<g class="l2">
			<rect x="-20" y="250" width="340" height="160" fill="#567c8d" />
			<path
				d="M-20 270 q25 -6 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0"
				fill="none"
				stroke="#c8d9e6"
				stroke-width="2"
				opacity=".5"
			/>
			<path
				d="M-20 300 q30 -7 60 0 t60 0 t60 0 t60 0 t60 0 t60 0"
				fill="none"
				stroke="#c8d9e6"
				stroke-width="2"
				opacity=".3"
			/>
		</g>
		<g class="l3">
			<path
				d="M-20 400 L-20 318 C60 300 150 330 210 370 C240 390 250 400 250 400 Z"
				fill="#efe2d6"
			/>
			<path d="M-20 318 C60 300 150 330 210 370" fill="none" stroke="#2f4156" stroke-width="2" />
			<path d="M40 330 C38 300 44 270 56 244 L60 246 C50 272 46 300 48 330 Z" fill="#2f4156" />
			<path
				d="M58 244 C40 232 22 236 8 248 C26 242 42 242 58 248 Z M58 244 C62 226 78 218 96 220 C80 228 68 236 60 248 Z M58 244 C48 226 32 220 16 222 C32 230 46 238 57 248 Z M58 244 C76 238 92 244 104 256 C90 250 74 248 60 248 Z"
				fill="#2f4156"
			/>
		</g>
	{:else if scene === 'cliff'}
		<g class="l1">
			<path
				d="M-20 230 L40 212 L64 214 L64 196 L92 196 L92 206 L140 202 L330 226 L330 400 L-20 400 Z"
				fill="#7f9db0"
			/>
		</g>
		<g class="l2">
			<rect x="-20" y="262" width="340" height="150" fill="#567c8d" />
			<path
				d="M-20 282 q25 -6 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0"
				fill="none"
				stroke="#c8d9e6"
				stroke-width="2"
				opacity=".5"
			/>
			<g transform="translate(110 290)">
				<path d="M-22 0 C-14 7 14 7 24 0 L20 -2 L-18 -2 Z" fill="#2f4156" />
				<path
					d="M1 -2 L1 -30 M2 -29 C12 -22 15 -12 14 -4 L2 -4 Z"
					fill="#f5efeb"
					stroke="#2f4156"
					stroke-width="1.6"
				/>
			</g>
		</g>
		<g class="l3">
			<path
				d="M330 400 L330 250 C300 254 278 276 262 300 C246 326 232 360 222 400 Z"
				fill="#2f4156"
			/>
			<path
				d="M330 250 C300 254 278 276 262 300 L272 312 C286 290 306 272 330 268 Z"
				fill="#b5462b"
				opacity=".7"
			/>
			<path
				d="M276 300 l-4 14 M290 284 l-3 14 M304 272 l-2 13"
				stroke="#2f4156"
				stroke-width="1.4"
				stroke-linecap="round"
			/>
		</g>
	{:else if scene === 'falls'}
		<g class="l1">
			<path
				d="M-20 170 C40 120 90 150 130 116 C170 84 230 120 330 96 L330 400 L-20 400 Z"
				fill="#6f8fa3"
			/>
			<path
				d="M120 140 C126 200 122 260 128 330 L156 330 C150 260 154 200 148 136 Z"
				fill="#e4eef4"
			/>
			<g stroke="#a9c2d4" stroke-width="2" stroke-linecap="round" class="fall">
				<path d="M130 150 v40 M138 170 v50 M144 150 v30 M134 240 v40 M146 230 v50" />
			</g>
		</g>
		<g class="l2">
			<path
				d="M-20 320 C60 300 110 336 140 330 S230 300 330 318 L330 400 L-20 400 Z"
				fill="#567c8d"
			/>
			<ellipse cx="142" cy="330" rx="46" ry="10" fill="#e4eef4" opacity=".7" />
		</g>
		<g class="l3">
			<path d="M-20 400 L-20 300 C20 290 50 310 70 340 C84 362 90 384 92 400 Z" fill="#2f4156" />
			<path
				d="M330 400 L330 280 C300 284 270 310 252 340 C240 362 236 384 236 400 Z"
				fill="#2f4156"
			/>
			<path
				d="M20 300 c-8 -18 8 -30 20 -22 c8 -14 30 -8 28 8 c12 2 12 18 0 20 Z M270 286 c-6 -14 8 -24 18 -18 c6 -10 24 -6 22 6 c10 2 10 14 0 16 Z"
				fill="#2f4156"
			/>
		</g>
	{:else}
		<g class="l1">
			<path
				d="M-20 200 C60 170 140 196 200 176 S280 172 330 184 L330 400 L-20 400 Z"
				fill="#a9c2d4"
			/>
		</g>
		<g class="l2">
			<path d="M-20 270 L330 250 L330 400 L-20 400 Z" fill="#8aa7b9" />
			<!-- Konkan houses: tiled roofs, red-earth walls -->
			<g stroke="#2f4156" stroke-width="2" stroke-linejoin="round">
				<path d="M60 262 L96 236 L132 262 Z" fill="#b5462b" />
				<path d="M66 262 H126 V296 H66 Z" fill="#f5efeb" />
				<path d="M90 296 V278 H102 V296" fill="none" />
				<path d="M150 254 L178 234 L206 254 Z" fill="#9c4a33" />
				<path d="M155 254 H201 V282 H155 Z" fill="#efe2d6" />
			</g>
			<path d="M84 250 h24 M166 246 h24" stroke="#2f4156" stroke-width="1.2" />
		</g>
		<g class="l3">
			<path
				d="M120 400 C140 360 170 330 220 300 L240 304 C200 332 178 362 166 400 Z"
				fill="#c98b72"
			/>
			<path
				d="M252 330 C248 290 254 250 268 214 L272 216 C260 252 256 290 258 330 Z"
				fill="#2f4156"
			/>
			<path
				d="M270 214 C252 202 232 206 218 218 C236 212 252 212 270 218 Z M270 214 C276 196 292 188 310 190 C294 198 282 206 272 218 Z M270 214 C260 196 244 190 228 192 C244 200 258 208 269 218 Z"
				fill="#2f4156"
			/>
			<path d="M-20 400 L-20 340 C20 336 40 356 50 400 Z" fill="#2f4156" />
		</g>
	{/if}
</svg>

<style>
	.scene {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.l0,
	.l1,
	.l2,
	.l3 {
		transition: transform 0.6s var(--j-ease-out);
	}
	.l0 {
		transform: translateX(calc(var(--shift, 0) * 8px));
	}
	.l1 {
		transform: translateX(calc(var(--shift, 0) * 16px));
	}
	.l2 {
		transform: translateX(calc(var(--shift, 0) * 26px));
	}
	.l3 {
		transform: translateX(calc(var(--shift, 0) * 42px));
	}
	@media (prefers-reduced-motion: no-preference) {
		.fall {
			animation: fall 1.2s linear infinite;
		}
	}
	@keyframes fall {
		to {
			transform: translateY(14px);
			opacity: 0.4;
		}
	}
</style>
