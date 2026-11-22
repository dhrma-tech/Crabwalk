<script lang="ts">
	import InkIcon from './InkIcon.svelte';

	// Postage stamp per taluka (brief §5 "collectible details"): perforated edge, double frame, ink icon,
	// Devanagari name and a serial. Re-keyed by the parent so it "stamps" onto the card on change.
	let {
		icon,
		name,
		deva,
		no,
		caption
	}: { icon: string; name: string; deva: string; no: number; caption: string } = $props();
</script>

<div class="stamp" aria-hidden="true">
	<div class="face">
		<span class="no">{String(no).padStart(2, '0')}</span>
		<InkIcon name={icon} size={44} stroke={2} />
		<span class="deva j-deva" lang="mr">{deva}</span>
		<span class="cap">{name} · {caption}</span>
	</div>
</div>

<style>
	.stamp {
		--hole: 4px;
		width: 112px;
		padding: 7px;
		background: var(--beige);
		filter: drop-shadow(2px 3px 0 rgb(47 65 86 / 0.18));
		-webkit-mask:
			radial-gradient(var(--hole) at 50% 50%, #0000 96%, #000) calc(var(--hole) * -1.5)
				calc(var(--hole) * -1.5) / calc(var(--hole) * 3) calc(var(--hole) * 3) round,
			linear-gradient(#000 0 0) content-box;
		mask:
			radial-gradient(var(--hole) at 50% 50%, #0000 96%, #000) calc(var(--hole) * -1.5)
				calc(var(--hole) * -1.5) / calc(var(--hole) * 3) calc(var(--hole) * 3) round,
			linear-gradient(#000 0 0) content-box;
		transform: rotate(-5deg);
	}
	.face {
		position: relative;
		display: grid;
		justify-items: center;
		gap: 2px;
		padding: 10px 6px 8px;
		border: 1.5px solid var(--navy);
		outline: 1px solid var(--navy);
		outline-offset: -5px;
		background:
			radial-gradient(circle at 70% 20%, rgb(181 70 43 / 0.12), transparent 60%), var(--sky);
		color: var(--navy);
	}
	.no {
		position: absolute;
		top: 7px;
		right: 9px;
		font-family: var(--j-display);
		font-size: 12px;
	}
	.deva {
		font-size: 17px;
		line-height: 1.2;
	}
	.cap {
		font-size: 7.5px;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		text-align: center;
	}
</style>
