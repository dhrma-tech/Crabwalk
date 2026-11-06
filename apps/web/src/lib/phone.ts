// Phone links. Listings store numbers the field forms' way: 10 digits, no +91 (docs/VALUE_MAPPING.md). Calls and
// WhatsApp need the country code back, and a landline (STD + number) only dials from a mobile with +91 or 0.
/** International digits: 10-digit Indian numbers → 91XXXXXXXXXX; anything else as typed (digits only). */
export function intl(phone: string) {
	const d = phone.replace(/\D/g, '');
	if (d.length === 10) return `91${d}`;
	if (d.length === 11 && d.startsWith('0')) return `91${d.slice(1)}`;
	return d;
}
export const telHref = (phone: string) => {
	const d = intl(phone);
	return d.length === 12 && d.startsWith('91') ? `tel:+${d}` : `tel:${d}`;
};
export const waHref = (phone: string) => `https://wa.me/${intl(phone)}`;
