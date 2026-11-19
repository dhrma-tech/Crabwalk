import { obj, type Tool } from './shared.ts';

export const listMyTripsTool: Tool = {
	def: {
		name: 'list_my_trips',
		description: "The user's saved trips (refs like T1 for edit_plan / save_share).",
		parameters: obj({})
	},
	async run(ctx) {
		const { db } = ctx;
		// Own trips and the ones the user joined (P11 tripmates).
		const { data: joined } = await db
			.from('trip_members')
			.select('trip_id')
			.eq('user_id', ctx.userId);
		const { data } = await db
			.from('trips')
			.select('id, title, days, start_date')
			.or(
				[`owner_id.eq.${ctx.userId}`, ...(joined ?? []).map((j) => `id.eq.${j.trip_id}`)].join(',')
			)
			.order('created_at', { ascending: false })
			.limit(10);
		return (data ?? []).map((t, k) => {
			const ref = `T${k + 1}`;
			ctx.trips.set(ref, t.id);
			return { ref, title: t.title, days: t.days, start_date: t.start_date };
		});
	}
};
