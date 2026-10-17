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
