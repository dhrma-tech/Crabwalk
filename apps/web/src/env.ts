import { defineEnvVars } from '@sveltejs/kit/env';

// Values come from the repo-root .env (kit `env.dir` in vite.config.ts). Optional so CI can build without them.
const optional = (value: string | undefined) => value;

export const variables = defineEnvVars({
	SUPABASE_URL: { public: true, schema: optional },
	SUPABASE_ANON_KEY: { public: true, schema: optional },
	// Own PMTiles host (G3). The map reads `${PMTILES_BASE_URL}/manifest.json` to find the region file.
	PMTILES_BASE_URL: { public: true, schema: optional },
	// services/ola-proxy Worker URL. The web app never holds the Ola key itself.
	OLA_PROXY_URL: { schema: optional },
	// Stay price comparison (BACKEND §13). Adapter stays off until the partner account exists.
	AGODA_ENABLED: { schema: optional },
	AGODA_PARTNER_ID: { schema: optional },
	AGODA_API_KEY: { schema: optional },
	// Crabby (BACKEND §11, DECISIONS P8-1): Groq for travellers, Gemini for staff drafting only.
	// AI_PROVIDER=mock swaps in the scripted provider (local e2e). Model IDs come from env.
	GROQ_API_KEY: { schema: optional },
	GEMINI_API_KEY: { schema: optional },
	AI_MODEL_INTENT: { schema: optional },
	AI_MODEL_EXPLAIN: { schema: optional },
	AI_MODEL_DRAFT: { schema: optional },
	AI_PROVIDER: { schema: optional },
	// P12-4: snap and ask / reel screenshots go to a Groq vision model (travellers stay on Groq, P8-1).
	AI_MODEL_VISION: { schema: optional },
	// P12 group chat: HMAC key the server signs messages with (same value as Vault `crabby_key`).
	CRABBY_SIGNING_KEY: { schema: optional },
	// Web push (DECISIONS P9-3). Public key only — the private key lives in the trip-nudges function.
	VAPID_PUBLIC_KEY: { public: true, schema: optional },
	// P10 rate limits: HMAC secret for client keys (IPs are never stored).
	RATE_LIMIT_SALT: { schema: optional },
	// Dev-only auth bypass (lib/devAuth.ts). Ignored in production builds and off localhost.
	DEV_BYPASS_AUTH: { public: true, schema: optional },
	// Dev-only one-click sign-in on /login as real local accounts (lib/devAuth.server.ts). Same gate as above.
	DEV_QUICK_LOGIN: { schema: optional },
	DEV_LOGIN_ADMIN: { schema: optional },
	DEV_LOGIN_USER: { schema: optional },
	DEV_LOGIN_PASSWORD: { schema: optional },
	// TODO(before-deploy): restore full auth — temporary access gate (lib/server/gate.ts, docs/RESTORE_AUTH.md).
	// AUTH_MODE=temp_email_gate: guests need no sign-in; admins enter an ADMIN_EMAILS address. Anything else = full.
	AUTH_MODE: { schema: optional },
	ADMIN_EMAILS: { schema: optional },
	ADMIN_SESSION_SECRET: { schema: optional },
	// Team passcode asked together with the admin email (server only).
	ADMIN_PASSCODE: { schema: optional },
	// Server only: admin editor writes (after the admin cookie check) and admin session provisioning.
	SUPABASE_SERVICE_ROLE_KEY: { schema: optional }
});
