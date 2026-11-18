import { requireStaff } from '#lib/server/auth.ts';
import { serviceClient } from '#lib/server/service.ts';
import type { PageServerLoad } from './$types';

// First-party analytics (hardening T1-11): events per IST day for the last 30 days and the QR funnel, admins
// only. The table has no policies, so it is read with the service client after the admin check.
export const load: PageServerLoad = async (event) => {
	await requireStaff(event, 'admin');
	const db = serviceClient();
	const since = new Date(Date.now() + 5.5 * 3600e3 - 29 * 864e5).toISOString().slice(0, 10);
	const [daily, verified] = await Promise.all([
		db.rpc('analytics_daily', { _days: 30 }),
		db
			.from('analytics_events')
			.select('id', { count: 'exact', head: true })
			.eq('name', 'qr_verify')
			.eq('props->>verified', 'true')
			.gte('day', since)
	]);
	const rows = daily.data ?? [];
	const total = (name: string) => rows.filter((r) => r.name === name).reduce((a, r) => a + r.n, 0);
	return {
		rows,
		funnel: {
			landing: total('qr_landing'),
			checks: total('qr_verify'),
			verified: verified.count ?? 0
		}
	};
};
