import { getLocale, type Locale } from '#lib/paraglide/runtime.js';

// FRONTEND §10: Indian grouping per UI locale (en-IN / hi-IN / mr-IN).
const intl = (locale: Locale = getLocale()) => `${locale}-IN`;

export const formatNumber = (n: number, locale?: Locale) =>
	new Intl.NumberFormat(intl(locale), { maximumFractionDigits: 1 }).format(n);

// Not style:'currency' — ICU's mr-IN currency pattern drops lakh grouping (₹१२५,०००).
export const formatINR = (n: number, locale?: Locale) => `₹${formatNumber(n, locale)}`;

export const formatINRRange = (min: number, max: number, locale?: Locale) =>
	`₹${formatNumber(min, locale)}–${formatNumber(max, locale)}`;

export const formatDate = (d: Date | string, locale?: Locale) =>
	new Intl.DateTimeFormat(intl(locale), { day: 'numeric', month: 'short', year: 'numeric' }).format(
		new Date(d)
	);

// FRONTEND §6.10 alert banners: "Reported 2 h ago · expires in 22 h".
/** Relative time from now in the UI locale ("2 hours ago", "in 22 hours"). */
export const relTime = (iso: string, locale?: Locale) => {
	const ms = Date.parse(iso) - Date.now();
	const rtf = new Intl.RelativeTimeFormat(intl(locale), { numeric: 'auto' });
	const min = Math.round(ms / 60000);
	if (Math.abs(min) < 60) return rtf.format(min, 'minute');
	const h = Math.round(min / 60);
	return Math.abs(h) < 48 ? rtf.format(h, 'hour') : rtf.format(Math.round(h / 24), 'day');
};
