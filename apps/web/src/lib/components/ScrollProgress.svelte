<!--
	Scroll pill under a sideways row (user, 2026-11-03): a gradient thumb rides a short track as the row scrolls,
	stretching a little mid-way. CSS scroll-driven animation, no JS: the row is a `scroll-row`, and a shared
	parent carries `scroll-scope` so this sibling can read its timeline. Hidden when the row doesn't overflow
	(inactive timeline) and in browsers without scroll timelines, which keep a thin native scrollbar instead.
-->
<div class="track" aria-hidden="true"><span class="thumb"></span></div>

<style>
	.track {
		display: none;
	}
	@supports (animation-timeline: scroll()) {
		.track {
			display: block;
			position: relative;
			width: 72px;
			height: 4px;
			margin: 4px auto 0;
			border-radius: 999px;
			background: var(--border);
			opacity: 0;
			animation: show linear both;
			animation-timeline: --row;
		}
		.thumb {
			position: absolute;
			inset-block: 0;
			left: 0;
			width: 40%;
			border-radius: inherit;
			background: linear-gradient(90deg, var(--kokum), var(--lagoon));
			box-shadow: 0 0 8px color-mix(in srgb, var(--kokum) 45%, transparent);
			animation: ride linear both;
			animation-timeline: --row;
		}
	}
	@keyframes show {
		from,
		to {
			opacity: 1;
		}
	}
	@keyframes ride {
		from {
			translate: 0;
			scale: 1 1;
		}
		50% {
			scale: 1.5 1;
		}
		to {
			translate: 150%;
			scale: 1 1;
		}
	}
</style>
