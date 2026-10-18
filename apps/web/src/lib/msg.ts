import { m } from '#lib/paraglide/messages.js';

/** Look up a message by computed key (enum values → labels). Falls back to the key itself. */
export const msg = (
	key: string,
	params?: Record<string, string | number>,
	locale?: 'en' | 'hi' | 'mr'
): string =>
	(
		m as unknown as Record<
			string,
			(p?: Record<string, string | number>, o?: { locale: string }) => string
		>
	)[key]?.(params, locale ? { locale } : undefined) ?? key;

/** "09:00:00" → "9:00 am" in the UI locale (IST wall-clock times). */
export const clock = (t: string, locale: string) => {
	const [h, min] = t.split(':').map(Number);
	return new Intl.DateTimeFormat(`${locale}-IN`, {
		hour: 'numeric',
		minute: '2-digit',
		timeZone: 'UTC'
	}).format(new Date(Date.UTC(2000, 0, 1, h, min)));
};
