<script lang="ts">
	import Sun from '@lucide/svelte/icons/sun';
	import Cloud from '@lucide/svelte/icons/cloud';
	import CloudRain from '@lucide/svelte/icons/cloud-rain';
	import CloudDrizzle from '@lucide/svelte/icons/cloud-drizzle';
	import CloudLightning from '@lucide/svelte/icons/cloud-lightning';
	import CloudFog from '@lucide/svelte/icons/cloud-fog';
	import Thermometer from '@lucide/svelte/icons/thermometer';
	import Waves from '@lucide/svelte/icons/waves';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { msg } from '#lib/msg.ts';
	import { formatNumber } from '#lib/format.ts';
	import { TIDE_ATTRIBUTION } from '#lib/tides.ts';
	import { conditionKey, pickToday, WEATHER_ATTRIBUTION, type TodayData } from '#lib/today.ts';

	// "Today on the coast" (Report 2 §9.1, T-9/T-24): the FRONTEND §7.1 season strip plus cached weather and the
	// next low tide, each labelled, timed and attributed; anything missing is hidden. A solid surface, not glass:
	// it holds body text (Report 2 §11).
	let {
		today,
		season,
		here
	}: {
		today: TodayData;
		season: {
			seasons: string[];
			events: { name_en: string; name_hi: string | null; name_mr: string | null }[];
		};
		here: { lon: number; lat: number } | null;
	} = $props();

	const lang = getLocale();
	const picked = $derived(pickToday(today, here));
	const icons = {
		wx_clear: Sun,
		wx_clouds: Cloud,
		wx_rain: CloudRain,
		wx_drizzle: CloudDrizzle,
		wx_storm: CloudLightning,
		wx_haze: CloudFog
	} as Record<string, typeof Sun>;
	const istDay = (iso: string) =>
		new Date(Date.parse(iso) + 5.5 * 3600e3).toISOString().slice(0, 10);
	const time = (iso: string) =>
		new Intl.DateTimeFormat(`${lang}-IN`, {
			hour: 'numeric',
			minute: '2-digit',
			timeZone: 'Asia/Kolkata',
			...(istDay(iso) !== istDay(new Date().toISOString()) && { weekday: 'short' })
		}).format(new Date(iso));
	const chips = $derived([
		...season.seasons.map((s) => ({ key: s, text: msg(`season_${s}`), dot: 'bg-alphonso' })),
		...season.events.map((e) => ({
			key: e.name_en,
			text: (lang === 'hi' ? e.name_hi : lang === 'mr' ? e.name_mr : null) || e.name_en,
			dot: 'bg-kokum'
		}))
	]);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- external data-provider attribution links -->
{#if picked.weather || picked.tide || chips.length}
	{@const w = picked.weather}
	{@const t = picked.tide}
	{@const ck = w && conditionKey(w.condition)}
	{@const WxIcon = (ck && icons[ck]) || Thermometer}
	<section
		aria-labelledby="today-title"
		class="flex flex-col gap-4 rounded-lg bg-surface p-4 shadow-e1"
		data-testid="today"
		data-clip-check
	>
		<h2 id="today-title" class="type-h3">{m.today_title()}</h2>
		{#if w || t}
			<div class="grid gap-4 sm:grid-cols-2">
				{#if w}
					<div class="flex gap-3" data-testid="today-weather">
						<span
							class="flex size-10 shrink-0 items-center justify-center rounded-md bg-alphonso-50 text-alphonso-ink"
							><WxIcon size={20} aria-hidden="true" /></span
						>
						<div class="flex min-w-0 flex-col">
							<span class="type-label text-text-2">{m.today_weather({ place: w.name })}</span>
							<span class="type-body-strong"
								>{[`${formatNumber(Math.round(w.temp_c ?? 0))}°C`, ck && msg(ck)]
									.filter(Boolean)
									.join(' · ')}</span
							>
							<span class="type-small text-text-2"
								>{m.today_updated({ time: time(w.observed_at) })} ·
								<a href={WEATHER_ATTRIBUTION.url} rel="noopener" target="_blank" class="text-text-2"
									>{m.today_weather_by({ source: WEATHER_ATTRIBUTION.text })}</a
								></span
							>
						</div>
					</div>
				{/if}
				{#if t}
					<div class="flex gap-3" data-testid="today-tide">
						<span
							class="flex size-10 shrink-0 items-center justify-center rounded-md bg-lagoon-50 text-lagoon-ink"
							><Waves size={20} aria-hidden="true" /></span
						>
						<div class="flex min-w-0 flex-col">
							<span class="type-label text-text-2">{m.today_low_tide({ place: t.name })}</span>
							<span class="type-body-strong">{time(t.low.time)}</span>
							<span class="type-small text-text-2"
								>{formatNumber(t.low.height_m)} m ·
								<a
									href={TIDE_ATTRIBUTION[t.provider].url}
									rel="noopener"
									target="_blank"
									class="text-text-2">{TIDE_ATTRIBUTION[t.provider].text}</a
								></span
							>
						</div>
					</div>
				{/if}
			</div>
		{/if}
		{#if chips.length}
			<ul class="flex flex-wrap gap-2" aria-label={m.discover_season()}>
				{#each chips as c (c.key)}
					<li
						class="inline-flex min-h-8 items-center gap-2 rounded-full bg-surface-2 px-3 py-1 type-label"
					>
						<span class={['size-2 shrink-0 rounded-full', c.dot]} aria-hidden="true"></span>{c.text}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}
