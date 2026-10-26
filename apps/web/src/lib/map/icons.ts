// Pin glyphs drawn from the same Lucide icons the UI uses (<CategoryIcon> is the single swap point).
import { mount, unmount, type Component } from 'svelte';
import type { Map as MLMap } from 'maplibre-gl';
import BedDouble from '@lucide/svelte/icons/bed-double';
import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
import Fuel from '@lucide/svelte/icons/fuel';
import Banknote from '@lucide/svelte/icons/banknote';
import Hospital from '@lucide/svelte/icons/hospital';
import Pill from '@lucide/svelte/icons/pill';
import Shield from '@lucide/svelte/icons/shield';
import Toilet from '@lucide/svelte/icons/toilet';
import PlugZap from '@lucide/svelte/icons/plug-zap';
import Wrench from '@lucide/svelte/icons/wrench';
import Bus from '@lucide/svelte/icons/bus';
import TrainFront from '@lucide/svelte/icons/train-front';
import Ship from '@lucide/svelte/icons/ship';
import { categoryIcons } from '#lib/components/CategoryIcon.svelte';
import type { MapColors } from './style.ts';

export const utilityIcons = {
	fuel: Fuel,
	atm: Banknote,
	hospital: Hospital,
	pharmacy: Pill,
	police: Shield,
	toilet: Toilet,
	ev_charger: PlugZap,
	mechanic: Wrench,
	bus_stand: Bus,
	railway_station: TrainFront,
	ferry_jetty: Ship
} as const;
export type UtilityType = keyof typeof utilityIcons;

const SIZE = 18; // CSS px
const RATIO = 2;

async function toImage(icon: Component<Record<string, unknown>>, color: string) {
	const host = document.createElement('div');
	const inst = mount(icon, { target: host, props: { size: SIZE * RATIO, color, strokeWidth: 2 } });
	const svg = host.innerHTML.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
	unmount(inst);
	const img = new Image(SIZE * RATIO, SIZE * RATIO);
	// The load event, not img.decode(): Chromium can reject decode() for SVG data URLs while the page is busy.
	await new Promise<void>((resolve, reject) => {
		img.onload = () => resolve();
		img.onerror = () => reject(new Error(`pin glyph failed: ${icon.name}`));
		img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
	});
	return img;
}

/**
 * Registers `place-<category>`, `stay`, `eatery`, `util-<type>` images on the map (call after each style load),
 * in the theme's glyph colours (a theme switch reloads the style, which drops the old images).
 */
export async function addPinImages(map: MLMap, c: MapColors) {
	const jobs: [string, Component<Record<string, unknown>>, string][] = [
		...Object.entries(categoryIcons).map(
			([k, icon]) =>
				[`place-${k}`, icon, c.placeGlyph] as [string, Component<Record<string, unknown>>, string]
		),
		['stay', BedDouble as Component<Record<string, unknown>>, c.stayGlyph],
		['eatery', UtensilsCrossed as Component<Record<string, unknown>>, c.eateryGlyph],
		...Object.entries(utilityIcons).map(
			([k, icon]) =>
				[`util-${k}`, icon, c.utilityGlyph] as [string, Component<Record<string, unknown>>, string]
		)
	];
	// One glyph that fails to load must not take the other pins (and every overlay after them) down.
	await Promise.all(
		jobs.map(async ([name, icon, color]) => {
			if (map.hasImage(name)) return;
			const img = await toImage(icon, color).catch(() => null);
			if (img && !map.hasImage(name)) map.addImage(name, img, { pixelRatio: RATIO });
		})
	);
}
