import { describe, expect, it } from 'vitest';
import { lineText, plannerDefaults, profileSummary, type Line, type Profile } from './profile.ts';
import { personaRules } from './ai/persona.ts';

// P12 step D: what reaches the LLM is a short summary of the visible lines; quiz-only planner defaults; persona.
const base = {
	user_id: 'u',
	vehicle: 'car',
	mileage_kmpl: 18,
	budget_band: 'mid',
	interests: ['beach', 'fort'],
	pace: 'relaxed',
	diet: 'veg',
	seafood: false,
	group_type: 'couple',
	persona: 'playful',
	use_quiz: true,
	use_activity: false,
	use_chats: false,
	use_trips: false,
	scores: {},
	lines: [],
	quiz_done_at: null,
	created_at: '2026-11-04T00:00:00Z',
	updated_at: null
} as unknown as Profile;

describe('profile lines', () => {
	it("render in the reader's language from key + params", () => {
		const l: Line = {
			id: 'quiz:interests',
			source: 'quiz',
			key: 'prof_interests',
			params: { cats: ['beach', 'fort'] }
		};
		expect(lineText(l, 'en')).toBe('Likes: Beach, Fort');
		expect(
			lineText(
				{ id: 'v', source: 'quiz', key: 'prof_vehicle', params: { vehicle: 'car', kmpl: 18 } },
				'en'
			)
		).toBe('Travels by: Car (18 km/l)');
	});

	it('the LLM summary skips hidden lines, keeps at most 8, and is English', () => {
		const lines: Line[] = [
			{ id: 'a', source: 'quiz', key: 'prof_pace', params: { pace: 'relaxed' } },
			{ id: 'b', source: 'quiz', key: 'prof_seafood_no', hidden: true },
			{ id: 'c', source: 'chat', text: 'We travel with a toddler' },
			...Array.from({ length: 10 }, (_, k): Line => ({
				id: `u${k}`,
				source: 'user',
				text: `note ${k}`
			}))
		];
		const s = profileSummary({ ...base, lines } as unknown as Profile);
		expect(s).toContain('- Pace: Relaxed');
		expect(s).not.toContain('No seafood');
		expect(s.split('\n')).toHaveLength(8);
		expect(profileSummary(null)).toBe('none');
	});

	it('planner defaults come only from the quiz the user filled', () => {
		expect(plannerDefaults(base)).toEqual({
			interests: ['beach', 'fort'],
			pace: 'relaxed',
			group_type: 'couple',
			diet: 'veg',
			mileage: 18
		});
		expect(plannerDefaults({ ...base, use_quiz: false } as Profile).pace).toBeNull();
	});
});

describe('persona', () => {
	it('plain has no jokes; both styles keep safety plain', () => {
		expect(personaRules('plain', 'mr')).toContain('No jokes');
		for (const p of ['plain', 'playful'] as const)
			expect(personaRules(p, 'hi')).toContain('Never joke about safety');
		expect(personaRules('playful', 'mr')).toContain('मी तिरका चालतो');
	});
});
