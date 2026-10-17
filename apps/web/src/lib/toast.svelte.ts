// FRONTEND §6.10: toasts sit above the nav for 4 s.
export const toasts = $state<{ id: number; text: string }[]>([]);
let next = 0;

export function toast(text: string) {
	const id = next++;
	toasts.push({ id, text });
	setTimeout(() => {
		const i = toasts.findIndex((t) => t.id === id);
		if (i >= 0) toasts.splice(i, 1);
	}, 4000);
}
