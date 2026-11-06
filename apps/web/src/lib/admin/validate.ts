// Admin editor validation + completeness (client inline errors and the server use the same rules).
// Unknown = null, never false or a guess. Nothing here fills a value in.
import { DEFS, allFields, type Col, type EntryType, type Field, type Kind } from './fields.ts';

export type Values = Record<string, unknown>;
export type Rows = Record<string, Record<string, unknown>[]>;
export type Gps = { lat: number; lng: number };

export const isEmpty = (v: unknown) =>
	v === null ||
	v === undefined ||
	(typeof v === 'string' && v.trim() === '') ||
	(Array.isArray(v) && v.length === 0);

const decimals = (n: number) => (String(n).split('.')[1] ?? '').replace(/e.*$/i, '').length;
const HTTPS = /^https:\/\/[^\s]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 10-digit Indian number from what people type (+91, spaces, dashes, a leading 0). Not a guess: digits only. */
export function normPhone(v: string) {
	let d = v.replace(/\D/g, '');
	if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
	if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
	return d;
}

/** Trimmed value as stored: '' → null, phones as 10 digits. */
export function normalize(kind: Kind | Col['kind'], v: unknown): unknown {
	if (v === undefined) return null;
	if (typeof v === 'string') {
		const s = v.trim();
		if (!s) return null;
		return kind === 'phone' ? normPhone(s) : s;
	}
	if (Array.isArray(v)) {
		const a = v.map((x) => (typeof x === 'string' ? x.trim() : x)).filter((x) => !isEmpty(x));
		return a;
	}
	return v;
}

export type Ctx = { type: EntryType; regionPrefix?: string | null };

export function codePattern(ctx: Ctx) {
	const letter = DEFS[ctx.type].letter;
	if (!letter) return /^DISH-\d{3}$/;
	const p = ctx.regionPrefix ?? '[A-Z]{2,5}';
	return new RegExp(`^${p}-${letter}-\\d{3}$`);
}

/** Error text for one value (already normalised), or null. Empty values are never an error here. */
export function check(
	f: Pick<Field, 'kind' | 'options' | 'max' | 'min'> & { key?: string },
	v: unknown,
	ctx: Ctx
): string | null {
	if (isEmpty(v)) return null;
	const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
	switch (f.kind) {
		case 'text':
		case 'long':
			if (typeof v !== 'string') return 'Text expected';
			return v.length > (f.max ?? 4000) ? `Max ${f.max ?? 4000} characters` : null;
		case 'enum':
			return f.options?.includes(String(v)) ? null : 'Pick one of the listed options';
		case 'multi':
		case 'months': {
			if (!Array.isArray(v)) return 'List expected';
			const opts = f.kind === 'months' ? MONTH_SET : new Set(f.options ?? []);
			if (v.some((x) => !opts.has(String(x)))) return 'Pick from the listed options';
			if (new Set(v).size !== v.length) return 'Listed twice';
			return f.max && v.length > f.max ? `Max ${f.max}` : null;
		}
		case 'int':
		case 'money':
			if (!num(v) || !Number.isInteger(v))
				return f.kind === 'money' ? 'Whole rupees only' : 'Whole number only';
			if ((v as number) < (f.min ?? 0)) return `At least ${f.min ?? 0}`;
			return f.max != null && (v as number) > f.max ? `At most ${f.max}` : null;
		case 'km':
			if (!num(v) || (v as number) < 0) return 'Kilometres, 0 or more';
			return decimals(v as number) > 1 ? 'One decimal place, e.g. 3.5' : null;
		case 'tri':
			return typeof v === 'boolean' ? null : 'Yes, No or Unknown';
		case 'bool':
			return typeof v === 'boolean' ? null : 'Yes or No';
		case 'time':
			return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)) ? null : '24-hour time, e.g. 06:00';
		case 'date': {
			const s = String(v);
			const d = new Date(`${s}T00:00:00Z`);
			return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(+d) && d.toISOString().startsWith(s)
				? null
				: 'Date as YYYY-MM-DD';
		}
		case 'lines':
			if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) return 'One item per line';
			if (v.some((x) => (x as string).length > 500)) return 'A line is longer than 500 characters';
			return f.max && v.length > f.max ? `Max ${f.max} lines` : null;
		case 'urls':
			if (!Array.isArray(v)) return 'One link per line';
			if (v.some((x) => !HTTPS.test(String(x)) || String(x).length > 500))
				return 'Each link must start with https://';
			return f.max && v.length > f.max ? `Max ${f.max} links` : null;
		case 'url':
			return HTTPS.test(String(v)) && String(v).length <= 500
				? null
				: 'Link must start with https://';
		case 'phone':
			return /^\d{10}$/.test(String(v)) ? null : '10 digits, no +91 or spaces';
		case 'email':
			return EMAIL.test(String(v)) && String(v).length <= 254 ? null : 'Email address expected';
		case 'taluka':
		case 'tide':
			return UUID.test(String(v)) ? null : 'Pick from the list';
		case 'gps': {
			const g = v as Partial<Gps>;
			if (!num(g?.lat) || !num(g?.lng)) return 'Latitude and longitude, both';
			if (Math.abs(g.lat!) > 90 || Math.abs(g.lng!) > 180) return 'Not a real coordinate';
			if (decimals(g.lat!) > 6 || decimals(g.lng!) > 6) return 'At most 6 digits after the dot';
			return null;
		}
		case 'code':
			return codePattern(ctx).test(String(v))
				? null
				: ctx.type === 'dish'
					? 'DISH- and 3 digits, e.g. DISH-001'
					: `${ctx.regionPrefix ?? 'REGION'}-${DEFS[ctx.type].letter}- and 3 digits, e.g. ${ctx.regionPrefix ?? 'RTN'}-${DEFS[ctx.type].letter}-014`;
		case 'slug':
			return /^[a-z0-9][a-z0-9-]{1,80}$/.test(String(v))
				? null
				: 'Small letters, digits and dashes';
	}
	return null;
}
const MONTH_SET = new Set([
	'jan',
	'feb',
	'mar',
	'apr',
	'may',
	'jun',
	'jul',
	'aug',
	'sep',
	'oct',
	'nov',
	'dec'
]);

/** Cross-field rules from the forms and the schema. */
function crossErrors(type: EntryType, v: Values) {
	const out: Record<string, string> = {};
	const lohi = (lo: string, hi: string) => {
		const a = v[lo];
		const b = v[hi];
		if (typeof a === 'number' && typeof b === 'number' && b < a)
			out[hi] = 'Highest is below lowest';
	};
	if (type === 'stay') {
		lohi('price_min', 'price_max');
		lohi('form.peak_min', 'form.peak_max');
	}
	if (type === 'dish') lohi('form.price_min', 'form.price_max');
	if (type === 'place' && v.verification_method === 'desk' && isEmpty(v.source_urls))
		out.source_urls = 'A desk entry needs at least one source link';
	return out;
}

/** Errors for the given keys (all fields when omitted). */
export function validate(ctx: Ctx, v: Values, keys?: string[]) {
	const out: Record<string, string> = {};
	for (const f of allFields(ctx.type)) {
		if (keys && !keys.includes(f.key)) continue;
		const e = check(f, f.kind === 'gps' ? v[f.key] : normalize(f.kind, v[f.key]), ctx);
		if (e) out[f.key] = e;
	}
	for (const [k, e] of Object.entries(crossErrors(ctx.type, v)))
		if (!keys || keys.includes(k)) out[k] = e;
	return out;
}

export function validateRows(type: EntryType, rows: Rows, keys?: string[]) {
	const out: Record<string, string> = {};
	const ctx = { type };
	for (const r of DEFS[type].repeats) {
		if (keys && !keys.includes(r.key)) continue;
		const list = rows[r.key] ?? [];
		if (r.max && list.length > r.max) out[r.key] = `Max ${r.max} rows`;
		list.forEach((row, i) => {
			for (const c of r.cols) {
				const val = row[c.key];
				const kind = c.kind;
				const e =
					kind === 'weekday'
						? isEmpty(val) ||
							(Number.isInteger(val) && (val as number) >= 0 && (val as number) <= 6)
							? null
							: 'Pick a day'
						: kind === 'dish' || kind === 'eatery'
							? isEmpty(val) || UUID.test(String(val))
								? null
								: 'Pick from the list'
							: check({ kind, options: c.options }, val, ctx);
				if (e) out[`${r.key}.${i}.${c.key}`] = e;
			}
		});
		// Rows the table can't store without these.
		const need: Record<string, string[]> = {
			'place.hours': ['weekday'],
			'eatery.hours': ['weekday'],
			'place.seasonal': ['season', 'from_month', 'to_month'],
			'place.crowd': ['weekday', 'level'],
			'stay.offers': ['provider', 'deep_link'],
			'eatery.links': ['dish_id'],
			'dish.links': ['eatery_id']
		};
		for (const k of need[`${type}.${r.key}`] ?? [])
			list.forEach((row, i) => {
				if (isEmpty(row[k])) out[`${r.key}.${i}.${k}`] ??= 'Needed for this row';
			});
	}
	if (type === 'eatery') {
		const sig = (rows.links ?? []).filter((r) => r.is_signature === true).length;
		if (sig > 4 && (!keys || keys.includes('links'))) out.links = 'Max 4 signature dishes';
	}
	return out;
}

export type Missing = { key: string; label: string };

/** Empty required fields (forms' * questions), photo slots under their minimum and required rows. */
export function missingRequired(
	type: EntryType,
	v: Values,
	photoCounts: Record<string, number>,
	rows: Rows
): Missing[] {
	const out: Missing[] = [];
	for (const f of requiredFields(type, v))
		if (isEmpty(v[f.key])) out.push({ key: f.key, label: f.label });
	for (const s of DEFS[type].slots)
		if ((photoCounts[s.slot] ?? 0) < s.min) out.push({ key: `photos.${s.slot}`, label: s.label });
	for (const r of DEFS[type].repeats)
		if (r.min && (rows[r.key]?.length ?? 0) < r.min) out.push({ key: r.key, label: r.title });
	return out;
}

export const requiredFields = (type: EntryType, v: Values) =>
	allFields(type).filter(
		(f) => f.required || (f.requiredIf && f.requiredIf.in.includes(String(v[f.requiredIf.key])))
	);

/** Share of required items filled, 0–100. */
export function completeness(type: EntryType, v: Values, missing: Missing[]) {
	const total =
		requiredFields(type, v).length +
		DEFS[type].slots.filter((s) => s.min > 0).length +
		DEFS[type].repeats.filter((r) => r.min).length;
	return total ? Math.round(((total - missing.length) / total) * 100) : 100;
}

/** Next check due: visit date + the form's months (places 1, stays and eateries 3). */
export function recheckFrom(date: string, months: number) {
	const d = new Date(`${date}T00:00:00Z`);
	const day = d.getUTCDate();
	d.setUTCDate(1);
	d.setUTCMonth(d.getUTCMonth() + months);
	const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
	d.setUTCDate(Math.min(day, last));
	return d.toISOString().slice(0, 10);
}
