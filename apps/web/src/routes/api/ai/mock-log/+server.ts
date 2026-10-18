import { error, json } from '@sveltejs/kit';
import { AI_PROVIDER } from '$app/env/private';
import { mockLog } from '#lib/server/ai/mock.ts';
import type { RequestHandler } from './$types';

// Local e2e only: every payload the mock provider received ("no PII in payload" check, PLAN P8 acceptance).
export const GET: RequestHandler = () => {
	if (AI_PROVIDER !== 'mock' || import.meta.env.MODE !== 'e2e') error(404, 'not found');
	return json(mockLog);
};
