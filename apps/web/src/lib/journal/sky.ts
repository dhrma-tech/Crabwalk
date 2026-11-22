// Real-time sky for the hero (brief §7.1): Ratnagiri time (IST, UTC+5:30, no DST) → phase, sun/moon position and
// palette. Sunrise ≈ 06:45, sunset ≈ 18:30 here all year within ±40 min, close enough for an illustration.
export type Phase = 'dawn' | 'day' | 'golden' | 'night';

export type Sky = {
	phase: Phase;
	/** 0 → 1 across the visible arc (sun by day, moon by night); x and y in the 0–1 box of the sky layer. */
	x: number;
	y: number;
	top: string;
	bottom: string;
	sun: string;
	glow: string;
	hills: [string, string];
	sea: string;
	stars: number;
};

const IST = 5.5 * 3600e3;
export const istHours = (now = Date.now()) => {
	const d = new Date(now + IST);
	return d.getUTCHours() + d.getUTCMinutes() / 60;
};

export function phaseAt(h: number): Phase {
	if (h >= 5.75 && h < 7.5) return 'dawn';
	if (h >= 7.5 && h < 17.25) return 'day';
	if (h >= 17.25 && h < 19) return 'golden';
	return 'night';
}

const PALETTE: Record<Phase, Omit<Sky, 'phase' | 'x' | 'y'>> = {
	dawn: {
		top: '#a9c2d4',
		bottom: '#f3d9c9',
		sun: '#f7e3cf',
		glow: '#f0b9a0',
		hills: ['#b9c9d6', '#93adbf'],
		sea: '#5d8396',
		stars: 0
	},
	day: {
		top: '#b7cfdf',
		bottom: '#e4eef4',
		sun: '#f5efeb',
		glow: '#ffffff',
		hills: ['#a9c2d4', '#8aa7b9'],
		sea: '#567c8d',
		stars: 0
	},
	golden: {
		top: '#c8d9e6',
		bottom: '#f2cfae',
		sun: '#f6dcb8',
		glow: '#e9a679',
		hills: ['#b3b9c4', '#8f9fb0'],
		sea: '#4f7385',
		stars: 0
	},
	night: {
		top: '#16222f',
		bottom: '#2f4156',
		sun: '#f5efeb',
		glow: '#c8d9e6',
		hills: ['#2b3c50', '#22323f'],
		sea: '#1e3040',
		stars: 1
	}
};

/** Sky for an IST hour. Reduced motion or no clock → golden hour (brief §7.1). */
export function skyAt(h: number): Sky {
	const phase = phaseAt(h);
	// Sun from 06:00 (x 0) to 19:00 (x 1); moon from 19:00 to 06:00.
	const t = phase === 'night' ? ((h - 19 + 24) % 24) / 11 : (h - 6) / 13;
	const x = Math.min(1, Math.max(0, t));
	const y = 0.62 - Math.sin(x * Math.PI) * 0.5;
	return { phase, x, y, ...PALETTE[phase] };
}

export const GOLDEN = skyAt(17.9);
