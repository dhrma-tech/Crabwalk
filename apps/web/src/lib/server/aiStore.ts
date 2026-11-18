// Hardening T2-05: Crabby's cache and turn log through the service client. Lives outside lib/server/ai on purpose
// (AI code never imports the service client); hooks.server.ts hands it to the AI code (setStore). Failures are
// quiet: no cache hit, no log row — a turn never fails because of them.
import type { AiStore } from './ai/store.ts';
import { serviceClient } from './service.ts';

const rpc = () => serviceClient();

export const aiStore: AiStore = {
	async get(key) {
		try {
			const { data } = await rpc().rpc('ai_cache_get', { _key: key });
			return data ?? null;
		} catch {
			return null;
		}
	},
	async put(key, value, ttlS) {
		try {
			await rpc().rpc('ai_cache_put', { _key: key, _value: value as never, _ttl_s: ttlS });
		} catch {
			// no service client here
		}
	},
	async logTurn(t) {
		try {
			const { data } = await rpc().rpc('ai_turn_log', {
				_lang: t.lang,
				_outcome: t.outcome,
				_tools: t.tools.slice(0, 24),
				_rounds: t.rounds,
				_latency_ms: t.latencyMs,
				_validator_retries: t.validatorRetries,
				_cached: t.cached
			});
			return data ?? null;
		} catch {
			return null;
		}
	}
};

/** Thumbs on a recent turn (POST /api/ai/feedback). False when the turn is unknown or too old. */
export async function turnThumbs(turn: number, thumbs: -1 | 1) {
	try {
		const { data } = await rpc().rpc('ai_turn_thumbs', { _id: turn, _thumbs: thumbs });
		return data === true;
	} catch {
		return false;
	}
}
