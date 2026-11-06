// Other content tables the admin editor covers (lib/server/tables.ts), with their labels. Client-safe.
export const TABLES = {
	alerts: 'Alerts',
	team_questions: 'Verified team Q&A',
	reports: 'User reports',
	published_routes: 'Ready-made itineraries',
	qr_codes: 'QR plaques',
	events_calendar: 'Events and seasons',
	utility_pois: 'Utility points'
} as const;
export type TableName = keyof typeof TABLES;
export const isTable = (t: string): t is TableName => t in TABLES;
