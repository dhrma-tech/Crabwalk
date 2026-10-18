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
	AI_PROVIDER: { schema: optional }
});
