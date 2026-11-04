// Plan workspace lists, notes, recommendations and expenses (docs/P11 Plan workspace.md §3, §7). Writes go through RLS:
// members read, owner/editors write.
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/db.types.ts';
import { equalShares } from '#lib/expenses.ts';
import { cardAggs } from '../ratings.ts';
import { lonLat, tr, type Lang } from '../listings.ts';
import { describeStops, editTrip } from './trips.ts';

type DB = SupabaseClient<Database>;
type Kind = 'place' | 'stay' | 'eatery';
const TABLE = { place: 'places', stay: 'stays', eatery: 'eateries' } as const;
/** A listing's stop kind: food joins a day as a meal, a stay as that night's stay. */
export const STOP_KIND = { place: 'place', stay: 'stay', eatery: 'meal' } as const;

/**
 * Add a listing to a day: places and meals go before the night's stay, a stay replaces the night's stay.
 * Then the trip is re-timed like any edit. Returns false when the trip can't take it.
 */
export async function addToDay(db: DB, tripId: string, type: Kind, entityId: string, day: number) {
	const { data: trip } = await db
		.from('trips')
		.select('days, status, trip_stops(day, order, kind, entity_id)')
		.eq('id', tripId)
		.maybeSingle();
	if (!trip || trip.status === 'completed' || day > trip.days) return false;
	const days = Array.from({ length: trip.days }, (_, d) =>
		trip.trip_stops
			.filter((s) => s.day === d + 1)
			.sort((a, b) => a.order - b.order)
			.map((s) => ({ kind: s.kind, entity_id: s.entity_id }))
	);
	const list = days[day - 1]!;
	const kind = STOP_KIND[type];
	if (!list.some((s) => s.entity_id === entityId)) {
		if (kind === 'stay') {
			const rest = list.filter((s) => s.kind !== 'stay');
			list.splice(0, list.length, ...rest, { kind, entity_id: entityId });
		} else {
			const night = list.findIndex((s) => s.kind === 'stay');
			list.splice(night < 0 ? list.length : night, 0, { kind, entity_id: entityId });
		}
	}
	if (list.length > 30) return false;
	return !!(await editTrip(db, tripId, { days }));
}

/** A published listing's id by slug, or null. */
export async function listingId(db: DB, type: Kind, slug: string) {
	const { data } = await db
		.from(TABLE[type])
		.select('id')
		.eq('slug', slug)
		.eq('status', 'published')
		.maybeSingle();
	return data?.id ?? null;
}

export type WorkspaceItem = {
	id: string;
	kind: 'place' | 'note' | 'check';
	entity_type: Kind | null;
	entity_id: string | null;
	body: string | null;
	done: boolean;
	name: string | null;
	href: string | null;
	pt: { lon: number; lat: number } | null;
};

/** Lists with their items (names and points for places), the trip notes, and recommended places. */
export async function workspaceView(
	db: DB,
	tripId: string,
	stops: { entity_type: Kind; entity_id: string }[],
	lang: Lang
) {
	const [
		{ data: lists },
		{ data: items },
		{ data: notes },
		{ data: mates },
		{ data: spends },
		{ data: shares }
	] = await Promise.all([
		db
			.from('trip_lists')
			.select('id, title, position')
			.eq('trip_id', tripId)
			.order('position')
			.order('created_at'),
		db
			.from('trip_list_items')
			.select('id, list_id, kind, entity_type, entity_id, body, done, position')
			.eq('trip_id', tripId)
			.order('position')
			.order('created_at'),
		db.from('trip_notes').select('body').eq('trip_id', tripId).maybeSingle(),
		db
			.from('trip_members')
			.select('id, display_name, user_id, role')
			.eq('trip_id', tripId)
			.order('joined_at'),
		db
			.from('trip_expenses')
			.select('id, amount, category, label, paid_by, spent_on')
			.eq('trip_id', tripId)
			.order('created_at', { ascending: false }),
		db.from('trip_expense_shares').select('expense_id, member_id, amount').eq('trip_id', tripId)
	]);
	const places = (items ?? []).filter((i) => i.kind === 'place') as {
		entity_type: Kind;
		entity_id: string;
	}[];
	const info = await describeStops(db, places, lang);
	const taken = new Set([...stops, ...places].map((s) => s.entity_id));
	return {
		lists: (lists ?? []).map((l) => ({
			id: l.id,
			title: l.title,
			items: (items ?? [])
				.filter((i) => i.list_id === l.id)
				.map((i): WorkspaceItem => {
					const x = i.entity_id ? info.get(i.entity_id) : undefined;
					return {
						id: i.id,
						kind: i.kind,
						entity_type: i.entity_type as Kind | null,
						entity_id: i.entity_id,
						body: i.body,
						done: i.done,
						name: x?.name ?? null,
						href: x?.href ?? null,
						pt: x?.pt ?? null
					};
				})
				// A place that was unpublished drops out of the list view (RLS hides it).
				.filter((i) => i.kind !== 'place' || i.name)
		})),
		notes: notes?.body ?? '',
		// Expenses (§5) and roles (§6): tripmates by name only (no account ids or emails reach the page).
		tripmates: (mates ?? []).map((t) => ({
			id: t.id,
			name: t.display_name,
			account: !!t.user_id,
			role: t.role
		})),
		spends: (spends ?? []).map((s) => ({
			...s,
			shares: (shares ?? [])
				.filter((x) => x.expense_id === s.id)
				.map((x) => ({ member_id: x.member_id, amount: x.amount }))
		})),
		recommended: await recommended(db, stops, taken, lang)
	};
}

/** Published places in the trip's talukas, not yet in the trip or a list: gems, then best rated (§3). */
async function recommended(
	db: DB,
	stops: { entity_type: Kind; entity_id: string }[],
	taken: Set<string>,
	lang: Lang
) {
	const ids = (t: Kind) => stops.filter((s) => s.entity_type === t).map((s) => s.entity_id);
	const talukas = await Promise.all(
		(['place', 'stay', 'eatery'] as const).map(async (t) =>
			ids(t).length
				? ((await db.from(TABLE[t]).select('taluka_id').in('id', ids(t))).data ?? [])
				: []
		)
	);
	const inTrip = [...new Set(talukas.flat().map((r) => r.taluka_id))].filter(
		(t): t is string => !!t
	);
	if (!inTrip.length) return [];
	const { data } = await db
		.from('places')
		.select('id, slug, category, is_hidden_gem, location, place_translations(lang, name)')
		.eq('status', 'published')
		.in('taluka_id', inTrip)
		.order('is_hidden_gem', { ascending: false })
		.limit(60);
	const rows = (data ?? []).filter((p) => !taken.has(p.id));
	const aggs = await cardAggs(
		db,
		'place',
		rows.map((p) => p.id)
	);
	const score = (id: string) => {
		const a = aggs.get(id);
		return a && !a.is_new ? (a.winner_level ?? 0) * 1e6 + a.total : 0;
	};
	return rows
		.sort((a, b) => +b.is_hidden_gem - +a.is_hidden_gem || score(b.id) - score(a.id))
		.slice(0, 12)
		.map((p) => {
			const c = lonLat(p.location);
			return {
				slug: p.slug,
				name: tr(p.place_translations, lang) ?? p.slug,
				category: p.category,
				isGem: p.is_hidden_gem,
				pt: c ? { lon: c[0], lat: c[1] } : null
			};
		});
}

const text = z.string().trim().min(1);
const role = z.enum(['editor', 'viewer']);
/** POST /api/trips/:id/workspace operations. A new item without `list_id` starts the default list. */
export const workspaceOp = z.discriminatedUnion('op', [
	z.object({ op: z.literal('list.create'), title: text.max(80) }),
	z.object({ op: z.literal('list.rename'), id: z.uuid(), title: text.max(80) }),
	z.object({ op: z.literal('list.delete'), id: z.uuid() }),
	z.object({
		op: z.literal('item.add'),
		list_id: z.uuid().nullable(),
		list_title: text.max(80),
		item: z.discriminatedUnion('kind', [
			// By slug (search, Recommended) or by id (undo puts a removed place back).
			z.object({
				kind: z.literal('place'),
				type: z.enum(['place', 'stay', 'eatery']),
				slug: z.string().min(1).max(200).optional(),
				entity_id: z.uuid().optional()
			}),
			z.object({
				kind: z.enum(['note', 'check']),
				body: text.max(2000),
				done: z.boolean().optional()
			})
		])
	}),
	z.object({ op: z.literal('item.done'), id: z.uuid(), done: z.boolean() }),
	z.object({ op: z.literal('item.delete'), id: z.uuid() }),
	z.object({ op: z.literal('item.order'), list_id: z.uuid(), ids: z.array(z.uuid()).max(500) }),
	z.object({ op: z.literal('item.toDay'), id: z.uuid(), day: z.number().int().min(1).max(7) }),
	z.object({ op: z.literal('notes.save'), body: z.string().max(20000) }),
	z.object({ op: z.literal('mate.add'), name: text.max(60) }),
	z.object({ op: z.literal('mate.remove'), id: z.uuid() }),
	z.object({ op: z.literal('mate.role'), id: z.uuid(), role }),
	z.object({
		op: z.literal('spend.add'),
		amount: z.number().int().min(1).max(10_000_000),
		category: z.enum(['stay', 'food', 'fuel', 'entry', 'activities', 'other']),
		label: z.string().trim().max(120),
		paid_by: z.uuid(),
		spent_on: z.iso.date().nullable(),
		split: z.discriminatedUnion('custom', [
			z.object({ custom: z.literal(false), members: z.array(z.uuid()).min(1).max(20) }),
			z.object({
				custom: z.literal(true),
				shares: z
					.array(z.object({ member_id: z.uuid(), amount: z.number().int().min(0) }))
					.min(1)
					.max(20)
			})
		])
	}),
	z.object({ op: z.literal('spend.delete'), id: z.uuid() }),
	// Invites (§6, owner only via RLS): one live link per role, turned off together; email = add an account.
	z.object({ op: z.literal('invite.link'), role }),
	z.object({ op: z.literal('invite.revoke') }),
	z.object({ op: z.literal('invite.email'), email: z.email().max(254), role })
]);
export type WorkspaceOp = z.infer<typeof workspaceOp>;
/** What an applied operation hands back: new row ids (undo needs them), an invite token, an email result. */
export type OpResult = { id?: string; list_id?: string; token?: string; added?: boolean };

/** Apply one operation; false = not found / not allowed (RLS) / trip can't take it. */
export async function applyOp(db: DB, tripId: string, o: WorkspaceOp): Promise<OpResult | false> {
	const ok = ({ error }: { error: unknown }) => (error ? false : {});
	switch (o.op) {
		case 'list.create': {
			const { count } = await db
				.from('trip_lists')
				.select('id', { count: 'exact', head: true })
				.eq('trip_id', tripId);
			return ok(
				await db
					.from('trip_lists')
					.insert({ trip_id: tripId, title: o.title, position: count ?? 0 })
			);
		}
		case 'list.rename':
			return ok(
				await db.from('trip_lists').update({ title: o.title }).eq('id', o.id).eq('trip_id', tripId)
			);
		case 'list.delete':
			return ok(await db.from('trip_lists').delete().eq('id', o.id).eq('trip_id', tripId));
		case 'item.add': {
			let listId = o.list_id;
			if (!listId) {
				const { data, error } = await db
					.from('trip_lists')
					.insert({ trip_id: tripId, title: o.list_title })
					.select('id')
					.single();
				if (error) return false;
				listId = data.id;
			}
			const { count } = await db
				.from('trip_list_items')
				.select('id', { count: 'exact', head: true })
				.eq('list_id', listId);
			const base = { list_id: listId, trip_id: tripId, position: count ?? 0 };
			let row;
			if (o.item.kind !== 'place') {
				row = { ...base, kind: o.item.kind, body: o.item.body, done: o.item.done ?? false };
			} else {
				const id = o.item.entity_id
					? ((
							await db
								.from(TABLE[o.item.type])
								.select('id')
								.eq('id', o.item.entity_id)
								.eq('status', 'published')
								.maybeSingle()
						).data?.id ?? null)
					: o.item.slug
						? await listingId(db, o.item.type, o.item.slug)
						: null;
				if (!id) return false;
				row = { ...base, kind: 'place' as const, entity_type: o.item.type, entity_id: id };
			}
			const { data, error } = await db.from('trip_list_items').insert(row).select('id').single();
			return error ? false : { id: data.id, list_id: listId };
		}
		case 'item.done':
			return ok(
				await db
					.from('trip_list_items')
					.update({ done: o.done })
					.eq('id', o.id)
					.eq('trip_id', tripId)
			);
		case 'item.delete':
			return ok(await db.from('trip_list_items').delete().eq('id', o.id).eq('trip_id', tripId));
		case 'item.order': {
			const res = await Promise.all(
				o.ids.map((id, position) =>
					db
						.from('trip_list_items')
						.update({ position })
						.eq('id', id)
						.eq('list_id', o.list_id)
						.eq('trip_id', tripId)
				)
			);
			return res.every((r) => !r.error) && {};
		}
		case 'item.toDay': {
			const { data: it } = await db
				.from('trip_list_items')
				.select('entity_type, entity_id')
				.eq('id', o.id)
				.eq('trip_id', tripId)
				.eq('kind', 'place')
				.maybeSingle();
			if (!it?.entity_id) return false;
			if (!(await addToDay(db, tripId, it.entity_type as Kind, it.entity_id, o.day))) return false;
			return ok(await db.from('trip_list_items').delete().eq('id', o.id));
		}
		case 'notes.save':
			return ok(
				await db
					.from('trip_notes')
					.upsert({ trip_id: tripId, body: o.body }, { onConflict: 'trip_id' })
			);
		// Name-only tripmates (P11-2) are added by owner or editors; the owner can also remove account tripmates
		// (RLS). One with spends or shares can't be removed (the deferred foreign keys refuse it).
		case 'mate.add':
			return ok(await db.from('trip_members').insert({ trip_id: tripId, display_name: o.name }));
		case 'mate.remove':
			return ok(await db.from('trip_members').delete().eq('id', o.id).eq('trip_id', tripId));
		case 'mate.role':
			return ok(
				await db
					.from('trip_members')
					.update({ role: o.role })
					.eq('id', o.id)
					.eq('trip_id', tripId)
					.not('user_id', 'is', null)
			);
		case 'spend.add': {
			const shares = o.split.custom
				? o.split.shares.filter((s) => s.amount > 0)
				: equalShares(o.amount, o.split.members);
			if (shares.reduce((t, s) => t + s.amount, 0) !== o.amount) return false;
			const { data, error } = await db.rpc('log_trip_expense', {
				_trip: tripId,
				_amount: o.amount,
				_category: o.category,
				_label: o.label,
				_paid_by: o.paid_by,
				// Generated types mark every function argument non-null; these two are nullable in SQL.
				_spent_on: o.spent_on as string,
				_stop_id: null as unknown as string,
				_split_custom: o.split.custom,
				_shares: shares
			});
			return error ? false : { id: data };
		}
		case 'spend.delete':
			return ok(await db.from('trip_expenses').delete().eq('id', o.id).eq('trip_id', tripId));
		case 'invite.link': {
			const { data: live } = await db
				.from('trip_invites')
				.select('token')
				.eq('trip_id', tripId)
				.eq('role', o.role)
				.is('revoked_at', null)
				.limit(1)
				.maybeSingle();
			if (live) return { token: live.token };
			const { data, error } = await db
				.from('trip_invites')
				.insert({ trip_id: tripId, role: o.role })
				.select('token')
				.single();
			return error ? false : { token: data.token };
		}
		case 'invite.revoke':
			return ok(
				await db
					.from('trip_invites')
					.update({ revoked_at: new Date().toISOString() })
					.eq('trip_id', tripId)
					.is('revoked_at', null)
			);
		case 'invite.email': {
			const { data, error } = await db.rpc('add_trip_member_by_email', {
				_trip: tripId,
				_email: o.email,
				_role: o.role
			});
			return error ? false : { added: data };
		}
	}
}
