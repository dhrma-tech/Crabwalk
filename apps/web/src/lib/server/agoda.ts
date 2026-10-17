// Agoda Partners live price adapter (BACKEND §13, AGODA_ENABLED). Off until the partner account and its API
// docs exist (affiliate owner pending; ₹0 rule). Never guess the endpoint: returns null until implemented.
import { AGODA_API_KEY, AGODA_ENABLED, AGODA_PARTNER_ID } from '$app/env/private';

export const agodaEnabled = () => AGODA_ENABLED === 'true' && !!AGODA_PARTNER_ID && !!AGODA_API_KEY;

export async function agodaLivePrice(): Promise<{ price: number; fetchedAt: string } | null> {
	if (!agodaEnabled()) return null;
	console.warn('AGODA_ENABLED=true but the adapter is not implemented yet (DECISIONS P4-7)');
	return null;
}
