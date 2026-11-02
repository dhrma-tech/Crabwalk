// Openly licensed photos (DECISIONS T-7 / T-51): CC BY and CC BY-SA only — the same list the database checks.
// Our own photos carry no credit. Never unlicensed web images. No zod here: this module ships to the browser
// (Hero, field form), where zod's JIT probe trips the CSP; the server schema is #lib/server/photoCredit.ts.
export const LICENCES = [
	'CC BY 4.0',
	'CC BY-SA 4.0',
	'CC BY 3.0',
	'CC BY-SA 3.0',
	'CC BY 2.5',
	'CC BY-SA 2.5',
	'CC BY 2.0',
	'CC BY-SA 2.0'
] as const;
export type Licence = (typeof LICENCES)[number];

export type Credit = { name: string; licence: Licence; source: string };

/** The Creative Commons deed for a licence, e.g. CC BY-SA 4.0 → …/licenses/by-sa/4.0/. */
export const licenceUrl = (l: Licence) => {
	const [, kind, version] = /^CC (BY(?:-SA)?) (\d\.\d)$/.exec(l)!;
	return `https://creativecommons.org/licenses/${kind!.toLowerCase()}/${version}/`;
};

/** A complete credit for a licensed photo: author, a listed licence and an https source page. */
export const creditComplete = (c: { credit: string; licence: string; source_url: string }) =>
	c.credit.trim().length > 0 &&
	c.credit.trim().length <= 200 &&
	(LICENCES as readonly string[]).includes(c.licence) &&
	/^https:\/\/\S+$/.test(c.source_url) &&
	c.source_url.length <= 500;
