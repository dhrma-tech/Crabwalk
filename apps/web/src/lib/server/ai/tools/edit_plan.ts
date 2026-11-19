import { msg } from '#lib/msg.ts';
import { describeStops } from '../../planner/trips.ts';
import { obj, str, int, n, placeBySlug, propose, read, type Tool } from './shared.ts';

export const editPlanTool: Tool = {
	def: {
		name: 'edit_plan',
		description:
			'Change a saved trip: remove or add a place on a day, or move it. Returns a preview the user must apply.',
		parameters: obj(
			{
				trip: str('Trip ref, e.g. T1'),
				ops: {
					type: 'array',
					items: obj(
						{
							op: str('op', { enum: ['remove', 'add', 'move'] }),
							day: int('Day number'),
							place: str('Place slug'),
							to_day: int('Target day for move')
						},
						['op', 'day', 'place']
					)
				}
			},
			['trip', 'ops']
		)
	},
	async run(ctx, a) {
		const { db, lang } = ctx;
		const { s } = read(a);
		const tripId = ctx.trips.get(s('trip') ?? '');
		if (!tripId) return { error: 'unknown trip ref — call list_my_trips first' };
		const { data: t } = await db
			.from('trips')
			.select('id, title, days, trip_stops(day, order, kind, entity_type, entity_id)')
			.eq('id', tripId)
			.maybeSingle();
		if (!t) return { error: 'trip not found' };
		const order = Array.from({ length: t.days }, (_, d) =>
			t.trip_stops
				.filter((x) => x.day === d + 1)
				.sort((x, y) => x.order - y.order)
				.map((x) => ({ kind: x.kind, entity_id: x.entity_id }))
		);
		const info = await describeStops(db, t.trip_stops, lang);
		const slugOf = (id: string) => info.get(id)?.href?.split('/').at(-1);
		const changes: string[] = [];
		{
			const ops = Array.isArray(a.ops) ? (a.ops as Record<string, unknown>[]) : [];
			for (const op of ops) {
				const day = Number(op.day) - 1;
				const slug = String(op.place ?? '');
				if (!order[day]) return { error: `day ${op.day} not in trip` };
				if (op.op === 'add') {
					const p = await placeBySlug(db, slug);
					if (!p) return { error: `place ${slug} not found` };
					const stay = order[day]!.findIndex((x) => x.kind === 'stay');
					order[day]!.splice(stay < 0 ? order[day]!.length : stay, 0, {
						kind: 'place',
						entity_id: p.id
					});
					changes.push(
						`+ ${n(p.place_translations, lang)} → ${msg('plan_day_n', { n: day + 1 }, lang)}`
					);
				} else {
					const k = order[day]!.findIndex(
						(x) => x.kind === 'place' && slugOf(x.entity_id) === slug
					);
					if (k < 0) return { error: `${slug} is not on day ${op.day}` };
					const [x] = order[day]!.splice(k, 1);
					if (op.op === 'move') {
						const to = Number(op.to_day) - 1;
						if (!order[to]) return { error: `day ${op.to_day} not in trip` };
						const stay = order[to]!.findIndex((y) => y.kind === 'stay');
						order[to]!.splice(stay < 0 ? order[to]!.length : stay, 0, x!);
						changes.push(
							`↔ ${info.get(x!.entity_id)?.name} → ${msg('plan_day_n', { n: to + 1 }, lang)}`
						);
					} else changes.push(`− ${info.get(x!.entity_id)?.name}`);
				}
			}
		}
		const res = await propose(
			ctx,
			'edit_plan',
			{ title: t.title, lines: changes },
			{ trip_id: t.id, days: order }
		);
		return { ...res, changes };
	}
};
