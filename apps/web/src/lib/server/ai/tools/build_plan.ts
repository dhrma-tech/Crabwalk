import { msg } from '#lib/msg.ts';
import { lonLat } from '../../listings.ts';
import { computeTrip, describeStops, planInput } from '../../planner/trips.ts';
import { type Question } from '#lib/questions.ts';
import { plannerDefaults } from '../../profile.ts';
import {
	CATS,
	obj,
	str,
	int,
	startQuestion,
	daysQuestion,
	dateQuestion,
	groupQuestion,
	paceQuestion,
	propose,
	read,
	type Tool
} from './shared.ts';

export const buildPlanTool: Tool = {
	def: {
		name: 'build_plan',
		description:
			"Plan a trip with our deterministic planner. Pass what the user said; anything missing that changes the plan comes back as a question card the user answers (don't guess it). If the user picked 'Let Crabby decide' for days or pace, list it in crabby_decides. Returns a preview the user must apply.",
		parameters: obj(
			{
				days: int('1–7'),
				start: str('Railway station or bus stand name'),
				start_date: str('YYYY-MM-DD, from what the user said (today is in the system prompt)'),
				crabby_decides: {
					type: 'array',
					items: str('field', { enum: ['days', 'pace'] }),
					description: "Fields the user left to Crabby ('Let Crabby decide')"
				},
				interests: { type: 'array', items: str('category', { enum: CATS }) },
				pace: str('pace', { enum: ['relaxed', 'balanced', 'packed'] }),
				standout: { type: 'boolean', description: 'Prefer hidden gems and calm spots' },
				budget: int('Total ₹'),
				people: int('Group size'),
				group_type: str('group', { enum: ['family', 'couple', 'solo', 'friends'] }),
				diet: str('diet', { enum: ['veg', 'non_veg', 'jain'] })
			},
			[]
		)
	},
	async run(ctx, a) {
		const { db, lang } = ctx;
		const { s, i } = read(a);
		// "Ask, don't assume" (§4): anything missing that changes the plan comes back as one question card
		// built here from our data (start points, dates, enums) — the model never invents the options.
		// Preferences fall back to what the user told us before, or to "Let Crabby decide".
		const decide = new Set(Array.isArray(a.crabby_decides) ? (a.crabby_decides as string[]) : []);
		const startName = (s('start') ?? '').replace(/[%_]/g, '');
		const { data: st } = startName
			? await db
					.from('utility_pois')
					.select('name, location')
					.in('type', ['railway_station', 'bus_stand'])
					.ilike('name', `%${startName}%`)
					.order('type', { ascending: false })
					.limit(1)
					.maybeSingle()
			: { data: null };
		const c = st ? lonLat(st.location) : null;
		// What the user told us in the profile quiz counts as known (10.7); everything else is asked.
		const known = plannerDefaults(ctx.profile);
		const ask: Question[] = [];
		if (!st || !c) ask.push(await startQuestion(db, lang));
		if (!i('days') && !decide.has('days')) ask.push(daysQuestion(lang));
		if (!s('start_date')) ask.push(dateQuestion(lang));
		if (!s('group_type') && !known.group_type) ask.push(groupQuestion(lang));
		if (!s('pace') && !known.pace && !decide.has('pace')) ask.push(paceQuestion(lang));
		if (ask.length) {
			ctx.questions = ask.slice(0, 4);
			return {
				asked_user: ctx.questions.map((q) => q.header),
				note: 'Shown to the user as a question card. Stop and wait for their answers.'
			};
		}
		// "Let Crabby decide": pick, and say which and why (the explanation repeats it).
		const chose: string[] = [];
		if (decide.has('days')) chose.push(msg('q_chose_days', {}, lang));
		if (decide.has('pace')) chose.push(msg('q_chose_pace', {}, lang));
		const group = s('group_type') ?? known.group_type ?? 'family';
		const p = planInput.safeParse({
			days: decide.has('days') ? 2 : i('days'),
			start_date: s('start_date'),
			start: { label: st!.name ?? startName, lon: c![0], lat: c![1] },
			group_type: group,
			// Group size only scales the budget estimate (editable on the plan); stated in the preview.
			people: i('people') ?? (group === 'solo' ? 1 : 2),
			budget: i('budget') ?? null,
			interests: Array.isArray(a.interests) && a.interests.length ? a.interests : known.interests,
			pace: decide.has('pace') ? 'balanced' : (s('pace') ?? known.pace),
			standout: a.standout === true,
			diet: s('diet') ?? known.diet
		});
		if (!p.success)
			return {
				error: 'invalid plan inputs',
				issues: p.error.issues.map((x) => x.path.join('.'))
			};
		const { days } = await computeTrip(db, p.data);
		const info = await describeStops(
			db,
			days.flatMap((d) =>
				d.stops.map((x) => ({
					entity_type: (x.kind === 'meal' ? 'eatery' : x.kind) as 'place',
					entity_id: x.id
				}))
			),
			lang
		);
		const hm = (t: number) =>
			`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
		const lines = days.map(
			(d, k) =>
				`${msg('plan_day_n', { n: k + 1 }, lang)}: ` +
				d.stops
					.filter((x) => x.kind === 'place')
					.map(
						(x) =>
							`${hm(x.arrive)} ${info.get(x.id)?.name ?? '?'}${x.reasons.length ? ` (${x.reasons.map((r) => msg(`reason_${r}`, {}, lang)).join(', ')})` : ''}`
					)
					.join(' → ')
		);
		const res = await propose(
			ctx,
			'create_plan',
			{
				title: msg('plan_default_title', { days: p.data.days, from: p.data.start.label }, lang),
				lines: [...lines, ...chose, msg('q_people_note', { n: p.data.people }, lang)]
			},
			p.data
		);
		return { ...res, days: lines, ...(chose.length ? { crabby_chose: chose } : {}) };
	}
};
