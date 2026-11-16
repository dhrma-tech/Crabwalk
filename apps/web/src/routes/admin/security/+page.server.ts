import { requireStaff } from '#lib/server/auth.ts';
import { serviceClient } from '#lib/server/service.ts';
import type { PageServerLoad } from './$types';

// Security events (SEC-16): the last 200, admins only. The table has no policies, so it is read with the service
// client after the admin check. Rows hold hashes and rule names, never emails, passcodes or IPs.
export const load: PageServerLoad = async (event) => {
	await requireStaff(event, 'admin');
	const { data } = await serviceClient()
		.from('security_events')
		.select('id, at, kind, client_key, detail')
		.order('at', { ascending: false })
		.limit(200);
	return { events: data ?? [] };
};
