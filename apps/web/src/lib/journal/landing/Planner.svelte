<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { reducedMotion } from '#lib/motion.ts';
	import { inview } from '../inview.ts';
	import { tr } from '../i18n.ts';
	import { PLANNER, DAYS } from '../content/landing.ts';
	import Crabby from '#lib/components/Crabby.svelte';
	import InkIcon from './InkIcon.svelte';
	import Edge from './Edge.svelte';

	// Trip planner (brief §7.7): the demo plays itself when it comes into view. The request types out, Crabby
	// thinks, then the day assembles stop by stop while a mini map draws the route. D1/D2/D3 switch the day and
	// replay it. Server render and reduced motion: the finished plan.
	let day = $state(0);
	let typedAsk = $state(Infinity);
	let thinking = $state(false);
	let shown = $state(4);
	let armed = false;
	let timers: ReturnType<typeof setTimeout>[] = [];
	const ask = $derived(tr(PLANNER.ask));
	const stops = $derived(DAYS[day].stops);
	const path = $derived(
		stops
			.slice(0, shown)
			.map((s, i) => `${i ? 'L' : 'M'}${s.x} ${s.y}`)
			.join(' ')
	);

	const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
	function stop() {
		timers.forEach(clearTimeout);
		timers = [];
	}
	function play(d: number, withAsk: boolean) {
		stop();
		day = d;
		if (reducedMotion.current) {
			typedAsk = Infinity;
			thinking = false;
			shown = 4;
			return;
		}
		shown = 0;
		let t = 0;
		if (withAsk) {
			typedAsk = 0;
			const chars = [...ask];
			chars.forEach((_, k) => later((t = 200 + k * 34), () => (typedAsk = k + 1)));
			t += 300;
		}
		later(t, () => (thinking = true));
		t += withAsk ? 1500 : 800;
		later(t, () => (thinking = false));
		for (let k = 1; k <= 4; k++) later(t + k * 520, () => (shown = k));
	}
	onMount(() => {
		if (!reducedMotion.current) {
			armed = true;
			typedAsk = 0;
			shown = 0;
		}
		return stop;
	});
	const enter = () => armed && play(0, true);
</script>

<section class="planner" id="plan" aria-labelledby="plan-title">
	<Edge kind="torn" color="var(--beige)" />
	<div class="j-wrap grid">
		<div class="copy">
			<p class="j-caps eyebrow">{tr(PLANNER.eyebrow)}</p>
			<h2 id="plan-title" class="j-h2">{tr(PLANNER.title)}</h2>
			<p class="j-lead body">{tr(PLANNER.body)}</p>
			<div class="btns">
				<a href={resolve('/plan/new')} class="j-btn">{tr(PLANNER.plan)}</a>
				<a href={resolve('/itineraries')} class="j-btn ghost">{tr(PLANNER.ready)}</a>
			</div>
			<ul class="routes">
				{#each PLANNER.routes as r, i (i)}
					<li><a href={resolve('/itineraries')}>{tr(r)}</a></li>
				{/each}
			</ul>
		</div>

		<div class="chat" use:inview={{ onenter: enter, margin: '0px 0px -30% 0px' }}>
			<p class="demo j-caps">{tr(PLANNER.demo)}</p>
			<div class="me">
				<p>
					<span class="sr-only">{ask}</span>
					<span aria-hidden="true"
						>{[...ask].slice(0, typedAsk).join('')}{#if typedAsk < [...ask].length}<span
								class="caret"
							></span>{/if}</span
					>
				</p>
			</div>
			<div class="reply">
				<span class="avatar"
					><Crabby
						size={46}
						state={thinking
							? 'think'
							: shown < 4 && typedAsk >= [...ask].length
								? 'scuttle'
								: 'idle'}
						follow={false}
					/></span
				>
				<div class="plan">
					<div class="phead">
						<p class="ptitle">{tr(DAYS[day].title)}</p>
						<div class="tabs" role="tablist" aria-label={tr(PLANNER.days)}>
							{#each [...DAYS.keys()] as d (d)}
								<button
									role="tab"
									id="plan-tab-{d}"
									aria-selected={day === d}
									aria-controls="plan-panel"
									tabindex={day === d ? 0 : -1}
									onclick={() => play(d, false)}
									onkeydown={(e) => {
										if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
											const n = (d + (e.key === 'ArrowRight' ? 1 : 2)) % 3;
											play(n, false);
											document.getElementById(`plan-tab-${n}`)?.focus();
										}
									}}>D{d + 1}</button
								>
							{/each}
						</div>
					</div>

					<div class="body2" id="plan-panel" role="tabpanel" aria-labelledby="plan-tab-{day}">
						{#if thinking}
							<p class="thinking" role="status">
								{tr(PLANNER.thinking)}<span class="dots"><i></i><i></i><i></i></span>
							</p>
						{/if}
						<ol class="stops">
							{#each stops as s, i (day + '-' + i)}
								<li class={[i < shown && 'in']} aria-hidden={i >= shown}>
									<span class="rail" aria-hidden="true"
										><span class="dot"></span><span class="line"></span></span
									>
									<div>
										<p class="time">{s.time}</p>
										<p class="name">{tr(s.name)}</p>
										<span class="why"
											><InkIcon name="spark" size={13} stroke={3.4} />{tr(s.why)}</span
										>
									</div>
								</li>
							{/each}
						</ol>
						<svg class="mini" viewBox="0 0 100 100" role="img" aria-label={tr(PLANNER.mapLabel)}>
							<rect width="100" height="100" rx="10" fill="#c8d9e6" />
							<path d="M0 0 H22 C16 18 26 30 18 46 C12 60 24 72 16 100 H0 Z" fill="#a9c2d4" />
							<path
								d="M22 0 C16 18 26 30 18 46 C12 60 24 72 16 100"
								fill="none"
								stroke="#2f4156"
								stroke-width="1"
							/>
							<path d="M40 0 C46 30 60 50 100 58" fill="none" stroke="#f5efeb" stroke-width="2" />
							{#key day}
								<path
									d={path}
									fill="none"
									stroke="#2f4156"
									stroke-width="1.6"
									stroke-dasharray="1.5 2.5"
									stroke-linecap="round"
								/>
							{/key}
							{#each stops as s, i (day + '-' + i)}
								{#if i < shown}
									<g class="mpin">
										<circle
											cx={s.x}
											cy={s.y}
											r="4.2"
											fill={i === shown - 1 ? '#b5462b' : '#f5efeb'}
											stroke="#2f4156"
											stroke-width="1.2"
										/>
										<text
											x={s.x}
											y={s.y + 1.6}
											text-anchor="middle"
											font-size="4.4"
											font-weight="700"
											fill={i === shown - 1 ? '#fff' : '#2f4156'}>{i + 1}</text
										>
									</g>
								{/if}
							{/each}
						</svg>
					</div>

					<div class="pfoot">
						<p>{tr(PLANNER.estimate)} · <strong>{PLANNER.total}</strong></p>
						<div class="pbtn">
							<a href={resolve('/plan/new')} class="j-btn small">{tr(PLANNER.apply)}</a>
							<button class="link" onclick={() => play(day, day === 0)}>{tr(PLANNER.replay)}</button
							>
							<button class="link" onclick={() => (stop(), (shown = 0), (thinking = false))}
								>{tr(PLANNER.discard)}</button
							>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>

<style>
	.planner {
		position: relative;
		z-index: 6;
		background: var(--beige);
		padding: 104px 0;
	}
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
		gap: 56px;
		align-items: center;
	}
	.eyebrow {
		color: var(--muted);
	}
	h2 {
		margin-top: 10px;
	}
	.body {
		margin-top: 22px;
		max-width: 470px;
		color: var(--muted);
	}
	.btns {
		margin-top: 32px;
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}
	.routes {
		margin: 28px 0 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.routes a {
		display: inline-flex;
		align-items: center;
		min-height: 40px;
		padding: 0 14px;
		border-radius: 999px;
		border: 1px dashed var(--haze);
		background: var(--white);
		font-size: 14px;
		text-decoration: none;
	}
	.routes a:hover {
		border-style: solid;
		border-color: var(--navy);
	}
	.chat {
		position: relative;
		padding: 28px;
		border-radius: 32px;
		background: var(--white);
		border: 1.5px solid var(--navy);
		box-shadow: 8px 8px 0 var(--navy);
	}
	.demo {
		position: absolute;
		top: -12px;
		left: 28px;
		padding: 4px 10px;
		background: var(--laterite);
		color: var(--white);
		font-size: 10px;
		letter-spacing: 0.18em;
		transform: rotate(-2deg);
	}
	.me {
		display: flex;
		justify-content: flex-end;
	}
	.me p {
		max-width: 80%;
		min-height: 50px;
		padding: 14px 18px;
		border-radius: 22px 22px 6px 22px;
		background: var(--navy);
		color: var(--beige);
		font-size: 15px;
	}
	.caret {
		display: inline-block;
		width: 2px;
		height: 1em;
		margin-left: 2px;
		vertical-align: -2px;
		background: var(--beige);
		animation: blink 0.8s steps(1) infinite;
	}
	.reply {
		margin-top: 16px;
		display: flex;
		gap: 10px;
		align-items: flex-start;
	}
	.avatar {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 52px;
		height: 52px;
		border-radius: 999px;
		background: var(--sky);
	}
	.plan {
		flex: 1;
		min-width: 0;
		padding: 18px;
		border-radius: 6px 22px 22px 22px;
		background: var(--beige);
	}
	.phead {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	.ptitle {
		font-family: var(--j-display);
		font-size: 22px;
	}
	.tabs {
		display: flex;
		gap: 4px;
	}
	.tabs button {
		min-width: 44px;
		min-height: 36px;
		padding: 0 12px;
		border-radius: 999px;
		border: 1px solid var(--sky);
		background: var(--white);
		font-size: 13px;
		font-weight: 600;
	}
	.tabs button[aria-selected='true'] {
		background: var(--navy);
		border-color: var(--navy);
		color: var(--white);
	}
	.body2 {
		position: relative;
		margin-top: 18px;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 128px;
		gap: 14px;
		align-items: start;
	}
	.thinking {
		position: absolute;
		top: -6px;
		left: 0;
		z-index: 2;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: var(--muted);
	}
	.dots {
		display: inline-flex;
		gap: 3px;
	}
	.dots i {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--muted);
		animation: dot 1s ease-in-out infinite;
	}
	.dots i:nth-child(2) {
		animation-delay: 0.15s;
	}
	.dots i:nth-child(3) {
		animation-delay: 0.3s;
	}
	.stops {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.stops li {
		display: flex;
		gap: 14px;
		opacity: 0;
		transform: translateX(-10px);
		transition:
			opacity 0.4s,
			transform 0.5s var(--j-ease-out);
	}
	.stops li.in {
		opacity: 1;
		transform: none;
	}
	.rail {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 14px;
		flex: none;
	}
	.dot {
		width: 12px;
		height: 12px;
		margin-top: 6px;
		border-radius: 999px;
		border: 2px solid var(--navy);
		background: var(--white);
	}
	.line {
		flex: 1;
		width: 2px;
		min-height: 40px;
		background: var(--sky);
	}
	.stops li > div {
		flex: 1;
		min-width: 0;
		padding-bottom: 16px;
	}
	.time {
		font-size: 13px;
		font-weight: 600;
		color: var(--muted);
	}
	.name {
		margin-top: 2px;
		font-size: 17px;
		font-weight: 600;
	}
	.why {
		margin-top: 8px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 12px;
		border-radius: 999px;
		border: 1px solid var(--sky);
		background: var(--white);
		font-size: 13px;
		transform: scale(0.6);
		opacity: 0;
		transition:
			transform 0.45s var(--j-spring) 0.2s,
			opacity 0.3s 0.2s;
	}
	.in .why {
		transform: none;
		opacity: 1;
	}
	.mini {
		width: 100%;
		height: auto;
		border-radius: 12px;
		position: sticky;
		top: 0;
	}
	.mini path[stroke-dasharray] {
		animation: route 0.6s ease-out;
	}
	.mpin {
		transform-box: fill-box;
		transform-origin: 50% 100%;
		animation: pinpop 0.45s var(--j-spring) both;
	}
	.pfoot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		padding-top: 16px;
		border-top: 1px solid var(--line);
		font-size: 14px;
		color: var(--muted);
	}
	.pfoot strong {
		color: var(--navy);
	}
	.pbtn {
		display: flex;
		gap: 4px;
		align-items: center;
	}
	.j-btn.small {
		min-height: 44px;
		padding: 0 18px;
		font-size: 14px;
	}
	.link {
		min-height: 44px;
		padding: 0 10px;
		border: 0;
		background: transparent;
		font-size: 14px;
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	@keyframes blink {
		50% {
			opacity: 0;
		}
	}
	@keyframes dot {
		50% {
			transform: translateY(-3px);
			opacity: 0.4;
		}
	}
	@keyframes route {
		from {
			opacity: 0;
		}
	}
	@keyframes pinpop {
		from {
			transform: scale(0);
		}
	}
	@media (max-width: 1000px) {
		.grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (max-width: 520px) {
		.chat {
			padding: 18px;
		}
		.body2 {
			grid-template-columns: minmax(0, 1fr);
		}
		.mini {
			position: static;
			max-width: 180px;
			order: -1;
		}
		.avatar {
			display: none;
		}
	}
</style>
