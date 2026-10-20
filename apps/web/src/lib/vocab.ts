// Controlled vocabularies shared by forms, list filters and server schemas (BACKEND §3.3–3.5), so the
// three can't drift apart. Labels live in messages (`vibe_*`, `amenity_*`, `diet_*`).
export const VIBES = [
	'traditional_konkani_home',
	'family',
	'luxury',
	'business',
	'backpacker',
	'couple_friendly',
	'pet_friendly',
	'beachfront',
	'orchard_stay'
] as const;

export const AMENITIES = ['ac', 'hot_water', 'wifi', 'parking', 'power_backup'] as const;

export const DIETS = ['veg', 'non_veg', 'jain'] as const;
