// Minimal RFC 4180 CSV reader (Google Sheets / Excel "CSV UTF-8" export): quoted fields may hold commas,
// newlines and "" for a quote; CRLF or LF; a leading BOM is dropped. No dependency for one small format.

/** Parse CSV text into rows of fields. */
export function parseCsv(text: string): string[][] {
	const s = text.replace(/^﻿/, '');
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	for (let i = 0; i < s.length; i++) {
		const c = s[i]!;
		if (quoted) {
			if (c === '"' && s[i + 1] === '"') (field += '"'), i++;
			else if (c === '"') quoted = false;
			else field += c;
		} else if (c === '"' && field === '') quoted = true;
		else if (c === ',') row.push(field), (field = '');
		else if (c === '\n' || c === '\r') {
			if (c === '\r' && s[i + 1] === '\n') i++;
			row.push(field), (field = '');
			rows.push(row), (row = []);
		} else field += c;
	}
	if (field !== '' || row.length) row.push(field), rows.push(row);
	return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

/** Rows as objects keyed by the (trimmed) header row; `line` is the sheet row number (the header is row 1). */
export function records(text: string): { line: number; data: Record<string, string> }[] {
	const [head, ...body] = parseCsv(text);
	if (!head) return [];
	const keys = head.map((h) => h.trim());
	return body.map((r, i) => ({
		line: i + 2,
		data: Object.fromEntries(keys.map((k, j) => [k, (r[j] ?? '').trim()]))
	}));
}
