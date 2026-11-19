import { msg } from '#lib/msg.ts';
import { requestInput } from '../../requests.ts';
import { obj, str, int, n, listingBySlug, propose, read, type Tool } from './shared.ts';

export const requestStayTool: Tool = {
	def: {
		name: 'request_stay',
		description:
			"Ask a homestay or eatery that isn't on any booking site whether it is free (dates, guests, budget). The user confirms; the owner or our team replies on Crabwalk. Never claim a booking — there is no booking or payment here. Ask the user for missing dates or guests first.",
		parameters: obj(
			{
				type: str('What to ask', { enum: ['stay', 'eatery'] }),
				slug: str('Listing slug'),
				check_in: str('YYYY-MM-DD'),
				check_out: str('YYYY-MM-DD (stays)'),
				guests: int('Number of guests'),
				budget: int('Budget in ₹ per night (stays) or for the meal'),
				note: str('Short note for the owner')
			},
			['type', 'slug', 'check_in', 'guests']
		)
	},
	async run(ctx, a) {
		const { db, lang } = ctx;
		const { s, i } = read(a);
		const kind = s('type') === 'eatery' ? 'eatery' : 'stay';
		const r = requestInput.safeParse({
			type: kind,
			slug: s('slug'),
			check_in: s('check_in'),
			check_out: s('check_out') ?? null,
			guests: i('guests'),
			budget: i('budget') ?? null,
			note: s('note') ?? ''
		});
		if (!r.success) return { error: 'missing or bad dates / guests — ask the user' };
		const l = await listingBySlug(db, kind, r.data.slug);
		if (!l) return { error: 'listing not found' };
		const name = n(l.names, lang) ?? l.slug;
		return propose(
			ctx,
			'send_request',
			{
				title: msg('req_preview_title', { name }, lang),
				lines: [
					r.data.check_out ? `${r.data.check_in} – ${r.data.check_out}` : r.data.check_in,
					msg('req_guests', { n: r.data.guests }, lang),
					...(r.data.budget != null
						? [msg('req_budget', { budget: `₹${r.data.budget}` }, lang)]
						: []),
					msg('req_no_booking', {}, lang)
				]
			},
			r.data
		);
	}
};
