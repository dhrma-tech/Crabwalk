// DECISIONS P9-1: OSM sac_scale → easy / moderate / hard (null = not tagged; team assigns).
export function difficulty(sac: string | undefined): 'easy' | 'moderate' | 'hard' | null {
	if (!sac) return null;
	if (sac === 'hiking') return 'easy';
	if (sac === 'mountain_hiking') return 'moderate';
	return /alpine|demanding/.test(sac) ? 'hard' : null;
}
