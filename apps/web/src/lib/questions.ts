// "Ask, don't assume" question cards (product plan §4, P12 step C). When Crabby is missing something that changes
// the result it asks, never guesses: 1–4 questions, 2–4 options each, the recommended one marked, multi-select
// where several answers fit, "Other" (free text) always, and "Let Crabby decide" on choice questions — then Crabby
// says which option it picked and why. Questions for the group go to the trip chat as polls (step G), facts to
// our team (step E), availability to the owner (step I).
import { z } from 'zod';

export const question = z.object({
	header: z.string().trim().min(1).max(24),
	question: z.string().trim().min(3).max(200),
	options: z
		.array(
			z.object({ label: z.string().trim().min(1).max(60), recommended: z.boolean().optional() })
		)
		.min(2)
		.max(4),
	multi: z.boolean().optional(),
	/** Offer "Let Crabby decide" (preferences and trade-offs; not facts like where the trip starts). */
	decide: z.boolean().optional()
});
export const questionCard = z.array(question).min(1).max(4);
export type Question = z.infer<typeof question>;

/** What the user picked, as the next chat message ("Start point: Chiplun"); Crabby reads it like any message. */
export function answerText(
	qs: Question[],
	picks: { options: number[]; other: string; decide: boolean }[],
	decideLabel: string
): string {
	return qs
		.map((q, k) => {
			const p = picks[k]!;
			const value = p.decide
				? decideLabel
				: [
						...p.options.map((i) => q.options[i]!.label),
						...(p.other.trim() ? [p.other.trim()] : [])
					].join(', ');
			return `${q.header}: ${value}`;
		})
		.join('\n');
}
