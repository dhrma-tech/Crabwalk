<script lang="ts" module>
	export type Tripmate = { id: string; name: string; account: boolean };
	export type Category = 'stay' | 'food' | 'fuel' | 'entry' | 'activities' | 'other';
	export type TripSpend = {
		id: string;
		amount: number;
		category: Category;
		label: string | null;
		paid_by: string;
		spent_on: string | null;
		shares: { member_id: string; amount: number }[];
	};
</script>

<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { m } from '#lib/paraglide/messages.js';
	import { formatDate, formatINR } from '#lib/format.ts';
	import { balances, settle } from '#lib/expenses.ts';
	import type { WorkspaceOp } from '#lib/server/planner/workspace.ts';
	import Button from '../Button.svelte';

	// Expenses and balances (P11 §5, P11-2): name-only tripmates, spends split equally between chosen tripmates
	// or in custom rupee amounts (the form shows what's left), net per tripmate and a greedy "A pays B" list.
	// Tracking only: no payment links.
	let {
		tripmates,
		spends,
		editable = true,
		onop
	}: {
		tripmates: Tripmate[];
		spends: TripSpend[];
		editable?: boolean;
		onop: (o: WorkspaceOp) => void;
	} = $props();

	const CATS = {
		stay: m.budget_stay,
		food: m.budget_food,
		fuel: m.budget_fuel,
		entry: m.budget_entry,
		activities: m.budget_activities,
		other: m.plan_expense_other
	};
	const name = $derived(new Map(tripmates.map((t) => [t.id, t.name])));
	const ids = $derived(tripmates.map((t) => t.id));
	const net = $derived(balances(ids, spends));
	const pays = $derived(settle(net));
	// A tripmate in any spend can't be removed (the database refuses it).
	const used = $derived(
		new Set(spends.flatMap((s) => [s.paid_by, ...s.shares.map((x) => x.member_id)]))
	);

	let mate = $state('');
	function addMate() {
		const n = mate.trim();
		if (!n) return;
		onop({ op: 'mate.add', name: n });
		mate = '';
	}

	let amount = $state<number | null>(null);
	let label = $state('');
	let category = $state<Category>('food');
	let paidBy = $state('');
	let spentOn = $state('');
	let custom = $state(false);
	let skipped = $state<string[]>([]);
	let parts = $state<Record<string, number | null>>({});
	const payer = $derived(ids.includes(paidBy) ? paidBy : (ids[0] ?? ''));
	const chosen = $derived(ids.filter((id) => !skipped.includes(id)));
	const left = $derived((amount ?? 0) - ids.reduce((t, id) => t + (parts[id] ?? 0), 0));
	const valid = $derived(
		!!amount &&
			Number.isInteger(amount) &&
			amount >= 1 &&
			!!payer &&
			(custom ? left === 0 : chosen.length > 0)
	);
	function logSpend(e: SubmitEvent) {
		e.preventDefault();
		if (!valid || !amount) return;
		onop({
			op: 'spend.add',
			amount,
			category,
			label,
			paid_by: payer,
			spent_on: spentOn || null,
			split: custom
				? {
						custom: true,
						shares: ids.map((member_id) => ({ member_id, amount: parts[member_id] ?? 0 }))
					}
				: { custom: false, members: chosen }
		});
		amount = null;
		label = '';
		spentOn = '';
		parts = {};
	}
	const field = 'field h-11 w-full px-3 type-body text-text';
	const labelCls = 'flex flex-col gap-1.5 type-small text-text-2';
	const iconBtn =
		'flex size-11 shrink-0 items-center justify-center rounded-full text-text-2 hover:bg-surface-2 hover:text-text disabled:opacity-40 print:hidden';
</script>

<div class="flex flex-col gap-5" data-testid="expenses">
	<div class="flex flex-col gap-2">
		<h3 class="type-h3">{m.plan_tripmates()}</h3>
		<ul class="flex flex-wrap gap-2">
			{#each tripmates as t (t.id)}
				<li
					class="flex min-h-11 items-center gap-1 rounded-full bg-surface-2 pr-1 pl-4 type-body"
					data-testid="tripmate"
				>
					{t.name}
					{#if editable && !t.account}
						<button
							type="button"
							class={iconBtn}
							aria-label={m.plan_tripmate_remove({ name: t.name })}
							disabled={used.has(t.id)}
							onclick={() => onop({ op: 'mate.remove', id: t.id })}
							><X size={18} aria-hidden="true" /></button
						>
					{:else}
						<span class="w-3"></span>
					{/if}
				</li>
			{/each}
		</ul>
		{#if editable && tripmates.length < 20}
			<div class="flex gap-2 print:hidden">
				<input
					aria-label={m.plan_tripmate_name()}
					bind:value={mate}
					maxlength="60"
					placeholder={m.plan_tripmate_name()}
					class="field h-11 min-w-0 flex-1 px-3 type-body text-text"
					onkeydown={(e) => {
						if (e.key === 'Enter') addMate();
					}}
				/>
				<Button variant="secondary" onclick={addMate}>{m.plan_tripmate_add()}</Button>
			</div>
		{/if}
	</div>

	{#if editable && tripmates.length}
		<form
			class="flex flex-col gap-3 rounded-md border border-border p-3 print:hidden"
			onsubmit={logSpend}
			data-testid="spend-form"
		>
			<div class="grid grid-cols-2 gap-3">
				<label class={labelCls}>
					{m.plan_expense_amount()}
					<input
						type="number"
						inputmode="numeric"
						min="1"
						max="10000000"
						step="1"
						required
						bind:value={amount}
						class={field}
					/>
				</label>
				<label class={labelCls}>
					{m.plan_expense_category()}
					<select bind:value={category} class={field}>
						{#each Object.entries(CATS) as [k, text] (k)}
							<option value={k}>{text()}</option>
						{/each}
					</select>
				</label>
				<label class={['col-span-2', labelCls]}>
					{m.plan_expense_label()}
					<input bind:value={label} maxlength="120" class={field} />
				</label>
				<label class={labelCls}>
					{m.plan_expense_paid_by()}
					<select value={payer} onchange={(e) => (paidBy = e.currentTarget.value)} class={field}>
						{#each tripmates as t (t.id)}
							<option value={t.id}>{t.name}</option>
						{/each}
					</select>
				</label>
				<label class={labelCls}>
					{m.plan_expense_date()}
					<input type="date" bind:value={spentOn} class={field} />
				</label>
			</div>

			<fieldset class="flex flex-col gap-2">
				<legend class="mb-1.5 type-small text-text-2">{m.plan_expense_split()}</legend>
				<div class="flex flex-wrap gap-4">
					<label class="flex min-h-11 items-center gap-2 type-body">
						<input type="radio" class="size-5 accent-kokum" bind:group={custom} value={false} />
						{m.plan_expense_equal()}
					</label>
					<label class="flex min-h-11 items-center gap-2 type-body">
						<input type="radio" class="size-5 accent-kokum" bind:group={custom} value={true} />
						{m.plan_expense_custom()}
					</label>
				</div>
				<ul class="flex flex-col gap-1">
					{#each tripmates as t (t.id)}
						<li class="flex min-h-11 items-center gap-3">
							{#if custom}
								<span class="min-w-0 flex-1 truncate type-body">{t.name}</span>
								<input
									aria-label={m.plan_expense_share({ name: t.name })}
									type="number"
									inputmode="numeric"
									min="0"
									step="1"
									value={parts[t.id] ?? ''}
									oninput={(e) =>
										(parts[t.id] =
											e.currentTarget.value === '' ? null : Number(e.currentTarget.value))}
									class="field h-11 w-32 px-3 type-body text-text"
								/>
							{:else}
								<label class="flex flex-1 items-center gap-2 type-body">
									<input
										type="checkbox"
										class="size-5 accent-kokum"
										checked={!skipped.includes(t.id)}
										onchange={(e) =>
											(skipped = e.currentTarget.checked
												? skipped.filter((x) => x !== t.id)
												: [...skipped, t.id])}
									/>
									{t.name}
								</label>
							{/if}
						</li>
					{/each}
				</ul>
				{#if custom && amount}
					<p class="type-small text-text-2" aria-live="polite" data-testid="split-left">
						{left >= 0
							? m.plan_expense_left({ amount: formatINR(left) })
							: m.plan_expense_over({ amount: formatINR(-left) })}
					</p>
				{/if}
			</fieldset>
			<div>
				<Button type="submit" disabled={!valid}>{m.plan_expense_save()}</Button>
			</div>
		</form>
	{/if}

	{#if spends.length}
		<ul class="flex flex-col gap-2">
			{#each spends as s (s.id)}
				<li class="flex items-center gap-3 rounded-md bg-surface p-3 shadow-e1" data-testid="spend">
					<div class="flex min-w-0 flex-1 flex-col">
						<span class="truncate type-body text-text">{s.label || CATS[s.category]()}</span>
						<span class="type-small text-text-2">
							{CATS[s.category]()} · {m.plan_expense_paid({
								name: name.get(s.paid_by) ?? ''
							})}{s.spent_on ? ` · ${formatDate(s.spent_on)}` : ''}
						</span>
					</div>
					<span class="type-body-strong">{formatINR(s.amount)}</span>
					{#if editable}
						<button
							type="button"
							class={iconBtn}
							aria-label={m.plan_expense_delete()}
							onclick={() => onop({ op: 'spend.delete', id: s.id })}
							><Trash2 size={20} aria-hidden="true" /></button
						>
					{/if}
				</li>
			{/each}
		</ul>

		<div class="flex flex-col gap-2" data-testid="balances">
			<h3 class="type-h3">{m.plan_balances()}</h3>
			<ul class="flex flex-col gap-1">
				{#each tripmates as t (t.id)}
					{@const v = net.get(t.id) ?? 0}
					<li class="flex justify-between gap-3 type-body">
						<span class="min-w-0 truncate">{t.name}</span>
						<span class={v ? 'type-body-strong' : 'text-text-2'}>
							{v > 0
								? m.plan_balance_gets({ amount: formatINR(v) })
								: v < 0
									? m.plan_balance_owes({ amount: formatINR(-v) })
									: m.plan_balance_square()}
						</span>
					</li>
				{/each}
			</ul>
			<ul class="flex flex-col gap-1 rounded-md bg-surface-2 p-3" data-testid="settle">
				{#each pays as p (p.from + p.to)}
					<li class="type-body">
						{m.plan_settle_pays({
							from: name.get(p.from) ?? '',
							to: name.get(p.to) ?? '',
							amount: formatINR(p.amount)
						})}
					</li>
				{:else}
					<li class="type-body">{m.plan_settle_done()}</li>
				{/each}
			</ul>
		</div>
	{:else}
		<p class="type-small text-text-2">{m.plan_expense_empty()}</p>
	{/if}
	<p class="type-small text-text-2">{m.plan_expense_tracking()}</p>
</div>
