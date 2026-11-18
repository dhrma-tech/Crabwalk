// First-party analytics (hardening T1-11, UX-05): the only event names the server stores. Props are small
// counts and flags, never free text, ids of people, emails or locations.
export const EVENTS = [
	'page_view',
	'qr_landing',
	'qr_verify',
	'search',
	'filter_apply',
	'card_open',
	'save',
	'vote',
	'subscore',
	'review_submit',
	'plan_generate',
	'plan_share',
	'book_out',
	'request_send',
	'crabby_turn',
	'crabby_action_apply',
	'pack_download',
	'lang_switch',
	'web_vital'
] as const;
export type EventName = (typeof EVENTS)[number];
export type Props = Record<string, string | number | boolean>;
