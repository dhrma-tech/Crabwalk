// In-app activity for the profile (P12 step D, product plan 10.7): listing views and picked searches, sent only
// while the user has the "activity" source on in Me (the `cw_act` cookie mirrors that switch, so nobody else
// makes a request). The database refuses rows without the consent too (RLS), and keeps them 90 days.
export const ACTIVITY_COOKIE = 'cw_act';

type Activity =
	| { kind: 'view'; type: 'place' | 'stay' | 'eatery' | 'dish'; slug: string }
	| { kind: 'search'; query: string };

export function logActivity(a: Activity) {
	if (typeof document === 'undefined' || !document.cookie.includes(`${ACTIVITY_COOKIE}=1`)) return;
	void fetch('/api/me/activity', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(a),
		keepalive: true
	}).catch(() => {});
}
