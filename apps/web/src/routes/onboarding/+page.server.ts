import { tempGate } from '#lib/server/gate.ts';
import type { PageServerLoad } from './$types';

// Onboarding (docs/crabwalk-handoff/PLAN.md §5.1). Sign-in reuses the /login actions (email code, Google). While the
// temporary access gate is on, those actions are closed, so the page says so and offers the guest path.
// TODO(before-deploy): restore full auth — then `gate` is false and email/Google work here too.
export const load: PageServerLoad = async ({ locals }) => {
	const user = await locals.getUser();
	return { gate: tempGate(), signedIn: !!user && !user.is_anonymous, email: user?.email ?? null };
};
