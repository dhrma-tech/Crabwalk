// Global AI budget and kill switch (hardening 2026-11, SEC-11). Lives outside lib/server/ai on purpose: AI code
// never imports the service-role client. hooks.server.ts hands this function to the router (setBudget).
import { serviceClient } from './service.ts';
import { securityEvent } from './log.ts';

/**
 * Takes one model call from today's budget (public.ai_budget_take). False = do not call the model: AI is
 * switched off (app_config ai_enabled), the day's budget is spent, or the counter cannot be reached.
 */
export async function takeAiBudget() {
	let reason = 'budget';
	try {
		const { data, error } = await serviceClient().rpc('ai_budget_take');
		if (!error && data === true) return true;
		if (error) reason = error.code || 'rpc';
	} catch {
		reason = 'no-service-client';
	}
	await securityEvent('ai_budget_refused', { reason });
	return false;
}
