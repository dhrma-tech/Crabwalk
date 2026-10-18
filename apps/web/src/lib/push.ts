// Web push for trip time nudges (DECISIONS P9-3). Consent first, then subscribe; iPhone needs the
// installed PWA. Unsubscribing removes the subscription and revokes the consent.
import { VAPID_PUBLIC_KEY } from '$app/env/public';

const b64 = (s: string) => {
	const raw = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
	return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export const pushSupported = () =>
	typeof window !== 'undefined' &&
	'serviceWorker' in navigator &&
	'PushManager' in window &&
	!!VAPID_PUBLIC_KEY;

export async function pushStatus(): Promise<'on' | 'off' | 'unsupported' | 'denied'> {
	if (!pushSupported()) return 'unsupported';
	if (Notification.permission === 'denied') return 'denied';
	const reg = await navigator.serviceWorker.ready;
	return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
}

export async function enablePush() {
	if ((await Notification.requestPermission()) !== 'granted') return false;
	const reg = await navigator.serviceWorker.ready;
	const sub =
		(await reg.pushManager.getSubscription()) ??
		(await reg.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: b64(VAPID_PUBLIC_KEY!)
		}));
	const res = await fetch('/api/push/subscribe', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(sub.toJSON())
	});
	return res.ok;
}

export async function disablePush() {
	const reg = await navigator.serviceWorker.ready;
	const sub = await reg.pushManager.getSubscription();
	await fetch('/api/push/subscribe', {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ endpoint: sub?.endpoint ?? null })
	});
	await sub?.unsubscribe();
}
