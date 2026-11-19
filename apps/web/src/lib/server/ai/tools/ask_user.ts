import { questionCard } from '#lib/questions.ts';
import { obj, str, type Tool } from './shared.ts';

export const askUserTool: Tool = {
	def: {
		name: 'ask_user',
		description:
			"Ask the user instead of guessing when an answer changes the result (dates, budget, pace, food, which stay, trade-offs). 1–4 questions in one card, 2–4 short options each, mark the one you recommend, multi=true when several answers fit, decide=true to offer 'Let Crabby decide'. Never ask what the user already said or what a tool can look up. Options must come from what the user said or from tool results.",
		parameters: obj(
			{
				questions: {
					type: 'array',
					minItems: 1,
					maxItems: 4,
					items: obj(
						{
							header: str('2–3 word label, e.g. "Pace"'),
							question: str('The question'),
							options: {
								type: 'array',
								minItems: 2,
								maxItems: 4,
								items: obj({ label: str('Option'), recommended: { type: 'boolean' } }, ['label'])
							},
							multi: { type: 'boolean' },
							decide: { type: 'boolean' }
						},
						['header', 'question', 'options']
					)
				}
			},
			['questions']
		)
	},
	async run(ctx, a) {
		const q = questionCard.safeParse(a.questions);
		if (!q.success) return { error: 'bad question card: 1–4 questions, 2–4 options each' };
		ctx.questions = [...(ctx.questions ?? []), ...q.data].slice(0, 4);
		return { asked_user: q.data.map((x) => x.header), note: 'Shown as a card. Stop and wait.' };
	}
};
