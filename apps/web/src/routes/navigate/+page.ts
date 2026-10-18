// Navigation is a client-only page, prerendered so the service worker precaches it and it opens
// offline for any trip (FRONTEND §9; PLAN P9 acceptance: navigate a planned route fully offline).
export const ssr = false;
export const prerender = true;
