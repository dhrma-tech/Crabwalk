// Nightly (pg_cron): AI review summary per entity per language (BACKEND §5) — STUB until P8 wires the LLM router.
// Writes nothing: summaries must come from a model over approved reviews only, never invented here.
import { authorized, json } from '../_shared/cron.ts';

Deno.serve((req) => {
	if (!authorized(req)) return json({ error: 'unauthorized' }, 401);
	return json({ status: 'stub', note: 'review summaries arrive with Crabby (P8)' });
});
