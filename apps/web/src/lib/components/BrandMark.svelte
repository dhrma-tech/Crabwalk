<script lang="ts">
	// Suna logo mark: 蟹 (crab) in a hairline square. The glyph ships in the serif Latin font file (P10a-3).
	let { size = 26 }: { size?: number } = $props();
</script>

<span
	class="flex shrink-0 items-center justify-center border border-text font-display leading-none"
	style:width="{size}px"
	style:height="{size}px"
	style:font-size="{Math.round(size * 0.58)}px"
	aria-hidden="true">蟹</span
>
