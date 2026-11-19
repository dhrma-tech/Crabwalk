import { PAGES, SECTIONS } from '#lib/drive.ts';
import { obj, str, int, checkStep, type Tool } from './shared.ts';

export const driveTool: Tool = {
	def: {
		name: 'drive',
		description:
			"Do it for the user right away in the app (no confirm): open a page, open a listing, set list filters, open the map on a listing or with alerts, open one of their trips (ref from list_my_trips), or switch the open trip's section. Use when the user asks to show, open, go to or filter something. Only these pages — never admin, staff or owner pages.",
		parameters: obj(
			{
				steps: {
					type: 'array',
					maxItems: 4,
					items: obj(
						{
							action: str('What to do', {
								enum: ['openPage', 'openListing', 'setFilters', 'openMap', 'openTrip', 'switchTab']
							}),
							page: str('openPage / setFilters page', { enum: Object.keys(PAGES) }),
							type: str('openListing: listing type', {
								enum: ['place', 'stay', 'eatery', 'dish']
							}),
							slug: str('openListing / openMap: listing slug'),
							filters: {
								type: 'object',
								description:
									'setFilters: discover {category, hidden_gem:"1"}; stays {vibe, style, amenity, max_price}; food {diet: veg|non_veg|jain, authenticity, max_price}'
							},
							focus_type: str('openMap: listing type to focus', {
								enum: ['place', 'stay', 'eatery']
							}),
							alerts: { type: 'boolean', description: 'openMap: show road and monsoon alerts' },
							trip: str('openTrip: trip ref, e.g. T1'),
							section: str('switchTab: trip workspace section', { enum: [...SECTIONS] }),
							day: int('switchTab: itinerary day')
						},
						['action']
					)
				}
			},
			['steps']
		)
	},
	async run(ctx, a) {
		const steps = Array.isArray(a.steps) ? (a.steps as Record<string, unknown>[]).slice(0, 4) : [];
		const doing: string[] = [];
		const refused: string[] = [];
		for (const raw of steps) {
			const c = checkStep(ctx, raw ?? {});
			if (typeof c === 'string') refused.push(`${String(raw?.action)}: ${c}`);
			else {
				ctx.drive.push(c);
				doing.push(c.action);
			}
		}
		return {
			doing,
			...(refused.length ? { refused } : {}),
			note: 'These run in the app right after your reply; say in one short line what you are doing.'
		};
	}
};
