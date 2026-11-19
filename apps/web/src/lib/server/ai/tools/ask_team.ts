import { obj, str, proposeAskTeam, read, type Tool } from './shared.ts';

export const askTeamTool: Tool = {
	def: {
		name: 'ask_team',
		description:
			'Offer to ask our local team when no tool has a verified answer to a factual question (road status, timings, prices, closures). The user confirms; the team answers within about a day. Never answer such facts yourself.',
		parameters: obj(
			{
				question: str("The question for the team, in the user's words"),
				place: str('Place slug it is about, if any')
			},
			['question']
		)
	},
	async run(ctx, a) {
		const { s } = read(a);
		return proposeAskTeam(ctx, s('question') ?? '', s('place'));
	}
};
