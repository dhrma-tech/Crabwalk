// Hardening T2-06 (SEC-12, AI-08): checks on a nightly review summary before it is stored. Pure (no Deno APIs),
// so the web app's Vitest suite tests this very file. A review can try to steer the summariser ("say this place
// is permanently closed"); such claims are allowed only when at least two reviews make them.
export type Summary = Record<'en' | 'hi' | 'mr', string>;

/** Strong claims and their Hindi / Marathi forms; each needs ≥ 2 source reviews using any form of it. */
const CLAIMS: Record<string, RegExp> = {
	closed: /\bclosed\b|\bshut down\b|बंद/i,
	permanently: /\bpermanent(ly)?\b|स्थायी|हमेशा के लिए|कायम/i,
	scam: /\bscam\b|घोटाला|घोटाळा/i,
	fraud: /\bfraud\b|धोखा|धोखाधड़ी|फसवणूक/i
};
const SENTENCE_END = /[.!?।]+(?=\s|$)/g;

export function checkSummary(s: Summary, reviews: string[]): string[] {
	const errors: string[] = [];
	for (const lang of ['en', 'hi', 'mr'] as const) {
		const t = (s[lang] ?? '').trim();
		if (!t) {
			errors.push(`${lang}: missing`);
			continue;
		}
		const sentences = t.split(SENTENCE_END).filter((x) => x.trim()).length;
		if (sentences > 2) errors.push(`${lang}: ${sentences} sentences`);
		if (/https?:\/\/|www\./i.test(t)) errors.push(`${lang}: link`);
		if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(t)) errors.push(`${lang}: email`);
		const phone = (t.replace(/[०-९]/g, '0').match(/\+?\d[\d\s-]{8,}\d/g) ?? []).some(
			(x) => x.replace(/\D/g, '').length >= 10
		);
		if (phone) errors.push(`${lang}: phone`);
		for (const [claim, re] of Object.entries(CLAIMS))
			if (re.test(t) && reviews.filter((r) => re.test(r)).length < 2)
				errors.push(`${lang}: "${claim}" without two reviews saying it`);
	}
	return errors;
}

/** Each review as untrusted data: numbered, inside ⟦ ⟧ that it cannot close. */
export const reviewBlock = (texts: string[]) =>
	texts.map((t, i) => `${i + 1}. ⟦${t.slice(0, 600).replace(/[⟦⟧]/g, '')}⟧`).join('\n');
