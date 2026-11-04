<script lang="ts">
	import Phone from '@lucide/svelte/icons/phone';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { m } from '#lib/paraglide/messages.js';
	import { formatDate, formatINR } from '#lib/format.ts';
	import type { Report } from '#lib/server/report.ts';

	// Trip report (P12 step H, product plan 10.12): cover, Crabby's short summary (finalized versions), Pending,
	// day by day with the constraint behind each stop, places, food, stays, expenses, practical. Built from our
	// data; prices are estimates; "Data as of" and each place's last-verified date are shown. Prints as the PDF.
	let { r, summary = null }: { r: Report; summary?: string | null } = $props();
	const sec = 'flex flex-col gap-3 break-inside-avoid-page';
	const card =
		'flex flex-col gap-1.5 rounded-lg bg-surface p-4 shadow-e1 print:shadow-none print:border print:border-border';
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- listing routes built by our server -->
<article class="flex flex-col gap-8" data-testid="trip-report">
	<header class="flex flex-col gap-2">
		<h1 class="type-display">{r.cover.title}</h1>
		<p class="type-body text-text-2">
			{#if r.cover.startDate}{formatDate(
					r.cover.startDate
				)}{#if r.cover.endDate && r.cover.endDate !== r.cover.startDate}
					– {formatDate(r.cover.endDate)}{/if} ·
			{/if}{m.plan_n_days({ n: r.cover.days })}{#if r.cover.start}
				· {m.rep_from({ start: r.cover.start })}{/if}
			· {m.rep_tripmates({ n: r.cover.tripmates })}
		</p>
		{#if r.cover.budgetTotal != null}
			<p class="type-body-strong">
				{m.rep_budget({
					total: formatINR(r.cover.budgetTotal),
					each: formatINR(r.cover.perPerson ?? 0)
				})}
			</p>
		{/if}
		<p class="type-small text-text-2" data-testid="report-asof">
			{m.rep_asof({ date: formatDate(r.asOf) })} · {m.rep_estimates()}
		</p>
	</header>

	{#if summary}
		<p class="rounded-lg bg-lagoon-50 p-4 type-body" data-testid="report-summary">{summary}</p>
	{/if}

	{#if r.pending.length}
		<section class={sec} data-testid="report-pending">
			<h2 class="flex items-center gap-2 type-h2">
				<TriangleAlert
					size={20}
					class="text-alphonso-ink"
					aria-hidden="true"
				/>{m.rep_pending_title()}
			</h2>
			<ul class="flex flex-col gap-1">
				{#each r.pending as p (p)}
					<li class="type-body">
						<span class="mr-2 rounded-full bg-alphonso-50 px-2 py-0.5 type-label"
							>{m.pending()}</span
						>{p}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section class={sec}>
		<h2 class="type-h2">{m.rep_days()}</h2>
		{#each r.days as d (d.day)}
			<div class={card} data-testid="report-day">
				<h3 class="type-h3">
					{m.plan_day_n({ n: d.day })}{d.date ? ` · ${formatDate(d.date)}` : ''}
				</h3>
				<ol class="flex flex-col gap-2">
					{#each d.stops as s, k (k)}
						<li class="flex flex-col">
							<p class="type-body">
								{#if s.arrive}<span class="tabular-nums">{s.arrive}</span> ·
								{/if}{#if s.href}<a href={s.href}>{s.name}</a>{:else}{s.name}{/if}
								{#if s.travelMin}<span class="type-small text-text-2">
										· {m.rep_travel({ min: s.travelMin })}</span
									>{/if}
							</p>
							{#if s.reason}<p class="type-small text-text-2">{s.reason}</p>{/if}
							{#each s.constraints as c (c)}<p class="type-small text-danger">{c}</p>{/each}
						</li>
					{:else}
						<li class="type-small text-text-2">{m.plan_day_empty()}</li>
					{/each}
				</ol>
				{#if d.nearby.length}<p class="type-small text-text-2">{d.nearby.join(' · ')}</p>{/if}
			</div>
		{/each}
	</section>

	{#if r.places.length}
		<section class={sec}>
			<h2 class="type-h2">{m.rep_places()}</h2>
			{#each r.places as p (p.href)}
				<div class={card}>
					{#if p.photo}<img
							src={p.photo}
							alt=""
							loading="lazy"
							class="mb-2 aspect-video w-full rounded-md object-cover"
						/>{/if}
					<h3 class="type-h3"><a href={p.href}>{p.name}</a></h3>
					{#if p.story}<p class="type-body">{p.story}</p>{/if}
					<dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 type-small">
						{#if p.timings}<dt class="text-text-2">{m.rep_timings()}</dt>
							<dd>{p.timings}</dd>{/if}
						{#if p.fee}<dt class="text-text-2">{m.rep_fee()}</dt>
							<dd>{p.fee}</dd>{/if}
						{#if p.bestTime}<dt class="text-text-2">{m.rep_best_time()}</dt>
							<dd>{p.bestTime}</dd>{/if}
						{#if p.monsoon}<dt class="text-text-2">{m.rep_monsoon()}</dt>
							<dd>{p.monsoon}</dd>{/if}
					</dl>
					{#if p.dos}<p class="type-small"><b>{m.place_dos()}:</b> {p.dos}</p>{/if}
					{#if p.donts}<p class="type-small"><b>{m.place_donts()}:</b> {p.donts}</p>{/if}
					{#if p.safety}<p class="type-small text-danger">{p.safety}</p>{/if}
					{#if p.lastVerified}<p class="type-label text-text-2">
							{m.rep_verified({ date: formatDate(p.lastVerified) })}
						</p>{/if}
				</div>
			{/each}
		</section>
	{/if}

	{#if r.food.length || r.dishes.length}
		<section class={sec}>
			<h2 class="type-h2">{m.rep_food()}</h2>
			{#each r.food as f (f.href)}
				<div class={card}>
					<h3 class="type-h3"><a href={f.href}>{f.name}</a></h3>
					<p class="type-small text-text-2">
						{[
							f.priceForTwo != null ? m.rep_for_two({ price: formatINR(f.priceForTwo) }) : '',
							f.diet.join(', ')
						]
							.filter(Boolean)
							.join(' · ')}
					</p>
					{#if f.signature.length}<p class="type-small">
							{m.rep_signature()}: {f.signature.join(', ')}
						</p>{/if}
				</div>
			{/each}
			{#each r.dishes as d (d.href)}
				<p class="type-small">
					<a href={d.href}>{d.name}</a>{#if d.what}
						— {d.what}{/if}
				</p>
			{/each}
		</section>
	{/if}

	{#if r.stays.length}
		<section class={sec}>
			<h2 class="type-h2">{m.rep_stays()}</h2>
			{#each r.stays as s (s.href)}
				<div class={card}>
					<h3 class="type-h3"><a href={s.href}>{s.name}</a></h3>
					{#if s.price}<p class="type-small">{s.price} · {m.rep_estimate()}</p>{/if}
					{#if s.phone}<p class="flex items-center gap-1.5 type-small">
							<Phone size={14} aria-hidden="true" />{s.phone}
						</p>{/if}
					{#if s.amenities.length}<p class="type-small text-text-2">
							{s.amenities.join(' · ')}
						</p>{/if}
					{#if s.request}<p class="type-small">{m.rep_request({ status: s.request })}</p>{/if}
					{#each s.booking as b (b.href)}
						<a class="type-small print:hidden" href={b.href} target="_blank" rel="noopener"
							>{b.label}</a
						>
					{/each}
				</div>
			{/each}
		</section>
	{/if}

	<section class={sec}>
		<h2 class="type-h2">{m.rep_expenses()}</h2>
		<div class={card}>
			{#if r.expenses.estimate}
				<dl class="grid grid-cols-[1fr_auto] gap-y-1 type-body">
					{#each r.expenses.estimate as e (e.label)}<dt>{e.label}</dt>
						<dd class="tabular-nums">{formatINR(e.amount)}</dd>{/each}
					<dt class="type-body-strong">{m.rep_total_estimate()}</dt>
					<dd class="type-body-strong tabular-nums">{formatINR(r.expenses.total ?? 0)}</dd>
				</dl>
			{/if}
			<p class="type-body">{m.rep_spent({ spent: formatINR(r.expenses.actual) })}</p>
			<p class="type-small text-text-2">{m.rep_split_note()}</p>
		</div>
	</section>

	<section class={sec}>
		<h2 class="type-h2">{m.rep_practical()}</h2>
		<div class={card}>
			{#if r.practical.tides.length}
				<p class="type-body-strong">{m.rep_tides()}</p>
				{#each r.practical.tides as t (t)}<p class="type-small">{t}</p>{/each}
			{/if}
			<p class="type-body-strong">{m.rep_packing()}</p>
			<ul class="list-disc pl-5 type-small">
				{#each r.practical.packing as p (p)}<li>{p}</li>{/each}
			</ul>
			<p class="mt-2 rounded-md bg-danger-50 p-3 type-body-strong" data-testid="report-emergency">
				{m.rep_emergency()}
			</p>
		</div>
	</section>
</article>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
