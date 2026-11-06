// Admin editor field definitions (client + server; no secrets). Every column of places / stays / eateries /
// dishes (fields.test.ts checks against db.types.ts) plus every question of the team field forms (Drive:
// "Crabwalk Field STANDARD Form - Places", "Field Form - Stays and Hotels", "Field Form - Food").
// `required` = marked * in the form. Choice lists are the forms' options, lowercase, spaces → underscores
// (the forms' own import rule). Where a form question maps onto an existing column it edits that column, with
// the column's own allowed values; questions with no column are stored in listing_form (staff only).
//
// Value keys: `col` = a column · `tr.<lang>.<field>` = *_translations · `<jsonbcol>.<key>[.<sub>]` = a key inside a
// jsonb column · `form.<key>` = listing_form · `private.<key>` = listing_private · `gps` = location.
import { Constants } from '#lib/db.types.ts';
import { AMENITIES, DIETS, VIBES } from '#lib/vocab.ts';

const E = Constants.public.Enums;

export const TYPES = ['place', 'stay', 'eatery', 'dish'] as const;
export type EntryType = (typeof TYPES)[number];
export const TABLE = {
	place: 'places',
	stay: 'stays',
	eatery: 'eateries',
	dish: 'dishes'
} as const;
export const TR_TABLE = {
	place: 'place_translations',
	stay: 'stay_translations',
	eatery: 'eatery_translations',
	dish: 'dish_translations'
} as const;
export const LANGS = ['en', 'mr', 'hi'] as const;

export type Kind =
	| 'text'
	| 'long'
	| 'enum'
	| 'multi'
	| 'int'
	| 'money'
	| 'km'
	| 'tri'
	| 'bool'
	| 'time'
	| 'date'
	| 'months'
	| 'lines'
	| 'urls'
	| 'phone'
	| 'email'
	| 'url'
	| 'taluka'
	| 'tide'
	| 'gps'
	| 'code'
	| 'slug';

export type Field = {
	key: string;
	label: string;
	kind: Kind;
	options?: readonly string[];
	/** multi: most choices; text: most characters. */
	max?: number;
	min?: number;
	required?: boolean;
	/** Required only for some categories (Places form: safety notes). */
	requiredIf?: { key: string; in: readonly string[] };
	/** Team only: never in the app (listing_private). */
	private?: boolean;
	/** Devanagari (Marathi / Hindi) text: lang attribute + font. */
	lang?: 'mr' | 'hi';
	help?: string;
};
export type Section = { title: string; fields: Field[] };

export type Col = {
	key: string;
	label: string;
	kind: Kind | 'weekday' | 'dish' | 'eatery';
	options?: readonly string[];
};
/** Repeating rows: a child table, or a list kept in listing_form. `min` = rows the form requires. */
export type Repeat = {
	key: string;
	title: string;
	store: 'table' | 'form';
	cols: Col[];
	max?: number;
	min?: number;
};
/** Photo slots from the forms; `name` builds the file name, e.g. RTN-P-001_hero.jpg, RTN-S-001_room01.jpg. */
export type Slot = {
	slot: string;
	label: string;
	min: number;
	max: number;
	name: string;
	numbered: boolean;
};

export type TypeDef = {
	type: EntryType;
	label: string;
	/** Letter in the form ID (<REGION>-P-001); dishes use DISH-001. */
	letter: 'P' | 'S' | 'F' | null;
	/** Next check due = visit date + this many months (forms); null = no re-check. */
	recheckMonths: number | null;
	sections: Section[];
	repeats: Repeat[];
	slots: Slot[];
};

// ---------------------------------------------------------------- choice lists (forms)
export const MONTHS = [
	'jan',
	'feb',
	'mar',
	'apr',
	'may',
	'jun',
	'jul',
	'aug',
	'sep',
	'oct',
	'nov',
	'dec'
] as const;
export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const; // 0 = Sunday (place_hours)
const NET = ['none', 'weak', 'ok', 'strong', 'not_tested'] as const;
const CROWD = ['empty', 'calm', 'busy'] as const;
const ITEM_TYPE = ['veg', 'egg', 'non_veg', 'jain'] as const;
const YES_NO_ASK = ['yes', 'no', 'not_asked'] as const;
const PAY = ['cash', 'upi', 'card'] as const;
export const UTILITY_TYPES = [
	'fuel',
	'atm',
	'hospital',
	'pharmacy',
	'police',
	'toilet',
	'ev_charger',
	'mechanic',
	'bus_stand',
	'railway_station',
	'ferry_jetty'
] as const;
const FOOD_APPS = ['swiggy', 'zomato', 'eatsure', 'magicpin'] as const;
const OPERATORS = ['Jio', 'Airtel', 'Vi', 'BSNL'] as const;
const STAY_FOOD = ['veg', 'non_veg', 'malvani', 'jain', 'homemade_included'] as const;
const OFFER_PROVIDERS = [
	'agoda',
	'makemytrip',
	'booking_com',
	'airbnb',
	'goibibo',
	'own_site',
	'other'
] as const;

// ---------------------------------------------------------------- shared pieces
const names = (required: { mr: boolean }): Field[] => [
	{ key: 'tr.en.name', label: 'Name in English', kind: 'text', max: 120, required: true },
	{
		key: 'tr.mr.name',
		label: 'Name in Marathi',
		kind: 'text',
		max: 120,
		lang: 'mr',
		required: required.mr
	},
	{ key: 'tr.hi.name', label: 'Name in Hindi', kind: 'text', max: 120, lang: 'hi' }
];
const perLang = (field: string, label: string, kind: Kind, enRequired = false): Field[] =>
	LANGS.map((l) => ({
		key: `tr.${l}.${field}`,
		label: `${label} (${l === 'en' ? 'English' : l === 'mr' ? 'Marathi' : 'Hindi'})`,
		kind,
		required: l === 'en' && enRequired,
		...(l === 'en' ? {} : { lang: l })
	}));
const signoff = (
	visitKey: string | null,
	recheck: boolean,
	extra: Field[] = [],
	verifiedLabel = 'Checked in person by'
): Section => ({
	title: 'Check and sign',
	fields: [
		...(visitKey
			? [
					{
						key: visitKey,
						label: 'Visited in person? (Verified badge)',
						kind: 'bool' as const,
						required: true
					}
				]
			: []),
		{ key: 'team.verified_by', label: verifiedLabel, kind: 'text', max: 254, required: true },
		{
			key: 'last_verified_at',
			label: verifiedLabel.includes('Written') ? 'Written on' : 'Visit date',
			kind: 'date',
			required: true
		},
		{ key: 'team.reviewed_by', label: 'Checked by', kind: 'text', max: 254 },
		{ key: 'reviewed_on', label: 'Checked on', kind: 'date' },
		...(recheck
			? [{ key: 'next_recheck_at', label: 'Next check due', kind: 'date' as const, required: true }]
			: []),
		...extra
	]
});
const record: Section = {
	title: 'Record',
	fields: [
		{ key: 'slug', label: 'Web address (slug)', kind: 'slug', required: true },
		{ key: 'is_seed', label: 'Seed / test row', kind: 'bool' }
	]
};
const photoFacts = (byKey: string): Field[] => [
	{ key: `form.${byKey}`, label: 'Photos taken by', kind: 'text', max: 120, required: true },
	{ key: 'form.photos_taken_on', label: 'Photos taken on', kind: 'date', required: true }
];
const contact = (phoneRequired: boolean): Field[] => [
	{
		key: 'phone',
		label: 'Phone for guests (shown in app)',
		kind: 'phone',
		required: phoneRequired
	},
	{ key: 'whatsapp', label: 'WhatsApp number', kind: 'phone' },
	{ key: 'form.owner_name', label: 'Owner name', kind: 'text', max: 120, required: true },
	{
		key: 'private.owner_phone',
		label: "Owner's own phone",
		kind: 'phone',
		private: true,
		required: true,
		help: 'Owner login later. Never shown.'
	},
	{
		key: 'form.owner_informed',
		label: 'Owner told about free listing?',
		kind: 'tri',
		required: true
	}
];

// ---------------------------------------------------------------- places
const place: TypeDef = {
	type: 'place',
	label: 'Place',
	letter: 'P',
	recheckMonths: 1,
	sections: [
		{
			title: 'Basic details',
			fields: [
				{ key: 'code', label: 'Place ID', kind: 'code', required: true, help: 'e.g. RTN-P-014' },
				...names({ mr: true }),
				{
					key: 'category',
					label: 'Type of place',
					kind: 'enum',
					options: E.place_category,
					required: true
				},
				{ key: 'taluka_id', label: 'Taluka', kind: 'taluka', required: true },
				{
					key: 'form.village_or_area',
					label: 'Village or area',
					kind: 'text',
					max: 120,
					required: true
				},
				{ key: 'gps', label: 'GPS (main entrance)', kind: 'gps', required: true },
				{
					key: 'form.short_description',
					label: 'One-line description (cards)',
					kind: 'long',
					max: 150,
					required: true
				}
			]
		},
		{ title: 'Photos', fields: photoFacts('photos_taken_by') },
		{
			title: 'Story',
			fields: [
				...perLang('short_story', 'What makes it special', 'long', true),
				...perLang('history', 'History', 'long'),
				...perLang('significance', 'Why it matters', 'long', true),
				{
					key: 'private.source_notes',
					label: 'Who told you?',
					kind: 'long',
					private: true,
					required: true
				},
				{
					key: 'form.audio_points',
					label: 'Points for audio guide (one per line, 5–10)',
					kind: 'lines',
					max: 10,
					required: true
				}
			]
		},
		{
			title: 'When to visit, fees and timings',
			fields: [
				{ key: 'form.best_months', label: 'Best months', kind: 'months', required: true },
				{
					key: 'form.best_time_of_day',
					label: 'Best time of day',
					kind: 'enum',
					options: ['morning', 'afternoon', 'evening', 'sunset', 'any']
				},
				{ key: 'best_time_text', label: 'Why that time?', kind: 'long', required: true },
				{
					key: 'form.entry_fee_type',
					label: 'Entry fee',
					kind: 'enum',
					options: ['free', 'paid'],
					required: true
				},
				{ key: 'entry_fee_inr', label: 'Fee for adult (₹)', kind: 'money' },
				{ key: 'form.fee_child', label: 'Fee for child (₹)', kind: 'money' },
				{ key: 'form.fee_foreigner', label: 'Fee for foreigner (₹)', kind: 'money' },
				{ key: 'form.fee_camera', label: 'Camera fee (₹)', kind: 'money' },
				{ key: 'form.fee_parking', label: 'Parking fee (₹)', kind: 'money' },
				{ key: 'entry_fee_text', label: 'Fee notes', kind: 'long' },
				{
					key: 'form.hours_known',
					label: 'Do we know the timings?',
					kind: 'tri',
					required: true,
					help: 'No = app shows “hours unknown”.'
				},
				{ key: 'form.open_24h', label: 'Open all day and night?', kind: 'tri' },
				{ key: 'form.special_timings', label: 'Special timings', kind: 'long' },
				{
					key: 'form.timings_source',
					label: 'Where did you get timings?',
					kind: 'enum',
					options: ['board', 'staff', 'locals', 'not_available'],
					required: true
				},
				{
					key: 'visit_minutes',
					label: 'Visit time (minutes, 10–600)',
					kind: 'int',
					min: 10,
					max: 600
				},
				{
					key: 'dwell_minutes',
					label: 'Measured stay (minutes, 5–600)',
					kind: 'int',
					min: 5,
					max: 600
				}
			]
		},
		{
			title: 'How to reach',
			fields: [
				{
					key: 'form.distance_from_city_km',
					label: 'Distance from district HQ (km)',
					kind: 'km',
					required: true
				},
				{ key: 'form.road_notes', label: 'Road condition', kind: 'long', required: true },
				{
					key: 'form.last_stretch',
					label: 'Last part of the way',
					kind: 'enum',
					options: ['road', 'walk', 'trek', 'boat'],
					required: true
				},
				{ key: 'form.walk_minutes', label: 'Walk from parking (minutes)', kind: 'int', min: 0 },
				{ key: 'form.public_transport', label: 'Bus / rickshaw options', kind: 'long' },
				{ key: 'how_to_reach_text', label: 'How to reach (shown in app)', kind: 'long' },
				{
					key: 'nearest_station_text',
					label: 'Nearest railway station',
					kind: 'text',
					max: 200,
					required: true
				},
				{
					key: 'form.railway_km',
					label: 'Railway station distance (km)',
					kind: 'km',
					required: true
				},
				{
					key: 'nearest_bus_stop_text',
					label: 'Nearest bus stop',
					kind: 'text',
					max: 200,
					required: true
				},
				{ key: 'form.bus_stop_km', label: 'Bus stop distance (km)', kind: 'km', required: true },
				{ key: 'form.parking', label: 'Parking available?', kind: 'tri', required: true },
				{
					key: 'form.parking_type',
					label: 'Parking for',
					kind: 'enum',
					options: ['car_and_bike', 'bike_only', 'none']
				},
				{ key: 'form.parking_paid', label: 'Paid parking?', kind: 'tri' },
				{ key: 'form.parking_notes', label: 'Parking notes', kind: 'long' }
			]
		},
		{
			title: 'Visitor tips, safety and facilities',
			fields: [
				...perLang('dos', 'Do’s (one per line)', 'long', true),
				...perLang('donts', 'Don’ts (one per line)', 'long', true),
				...perLang('safety_text', 'Safety notes', 'long').map((f) =>
					f.key === 'tr.en.safety_text'
						? {
								...f,
								requiredIf: {
									key: 'category',
									in: ['beach', 'fort', 'waterfall', 'cave', 'viewpoint']
								},
								help: 'Must fill for beach, fort, waterfall, cave, viewpoint. Nothing seen → “None seen”.'
							}
						: f
				),
				{ key: 'form.toilets', label: 'Toilets on site?', kind: 'tri' },
				{ key: 'form.drinking_water', label: 'Drinking water?', kind: 'tri' },
				{ key: 'form.food_stalls', label: 'Food stalls?', kind: 'tri' },
				{ key: 'form.shade_seating', label: 'Shade or seating?', kind: 'tri' },
				{ key: 'form.changing_rooms', label: 'Changing rooms? (beaches)', kind: 'tri' },
				{ key: 'form.wheelchair_ok', label: 'Wheelchair friendly?', kind: 'tri' },
				{ key: 'form.elderly_friendly', label: 'Okay for elderly?', kind: 'tri' },
				{ key: 'form.kids_safe', label: 'Safe for kids?', kind: 'tri' },
				{
					key: 'form.steps',
					label: 'Steps or climbing',
					kind: 'enum',
					options: ['none', 'few', 'many', 'trek']
				},
				{ key: 'form.net_jio', label: 'Jio network', kind: 'enum', options: NET },
				{ key: 'form.net_airtel', label: 'Airtel network', kind: 'enum', options: NET },
				{ key: 'form.net_vi', label: 'Vi network', kind: 'enum', options: NET },
				{ key: 'form.net_bsnl', label: 'BSNL network', kind: 'enum', options: NET }
			]
		},
		{
			title: 'Season, crowd and tide',
			fields: [
				{
					key: 'monsoon_status',
					label: 'Monsoon status',
					kind: 'enum',
					options: E.monsoon_status,
					required: true
				},
				{ key: 'monsoon_reason', label: 'Why?', kind: 'long', required: true },
				{ key: 'form.monsoon_months', label: 'Months affected', kind: 'months' },
				{
					key: 'form.crowd_weekday',
					label: 'Crowd on weekdays',
					kind: 'enum',
					options: CROWD,
					required: true
				},
				{
					key: 'form.crowd_weekend',
					label: 'Crowd on weekends',
					kind: 'enum',
					options: CROWD,
					required: true
				},
				{
					key: 'form.crowd_peak',
					label: 'Crowd in peak season',
					kind: 'enum',
					options: CROWD,
					required: true
				},
				{
					key: 'form.crowd_monsoon',
					label: 'Crowd in monsoon',
					kind: 'enum',
					options: CROWD,
					required: true
				},
				{ key: 'is_hidden_gem', label: 'Hidden gem? (be strict)', kind: 'bool', required: true },
				{
					key: 'is_tide_dependent',
					label: 'Depends on tide? (reachable only at low tide)',
					kind: 'bool',
					required: true
				},
				{ key: 'tide_station_id', label: 'Tide station', kind: 'tide' },
				{ key: 'form.tide_notes', label: 'Tide notes', kind: 'long' }
			]
		},
		{
			title: 'Nearby',
			fields: [
				{ key: 'food_delivery.swiggy', label: 'Swiggy delivers here?', kind: 'tri' },
				{ key: 'food_delivery.zomato', label: 'Zomato delivers here?', kind: 'tri' },
				{ key: 'food_delivery.eatsure', label: 'EatSure delivers here?', kind: 'tri' },
				{ key: 'food_delivery.magicpin', label: 'Magicpin delivers here?', kind: 'tri' },
				{ key: 'form.delivery_other', label: 'Other food apps working', kind: 'text', max: 200 },
				{ key: 'form.alternative_note', label: 'Similar or calmer place nearby', kind: 'long' }
			]
		},
		{
			title: 'Permission for QR plaque',
			fields: [
				{
					key: 'form.permission_authority',
					label: 'Who gives permission?',
					kind: 'enum',
					options: [
						'asi',
						'state_archaeology',
						'temple_trust',
						'gram_panchayat',
						'private_owner',
						'forest_dept',
						'not_needed'
					],
					required: true
				},
				{ key: 'form.permission_contact', label: 'Contact person', kind: 'text', max: 120 },
				{ key: 'form.permission_phone', label: 'Contact phone', kind: 'phone' },
				{
					key: 'form.permission_status',
					label: 'Permission status',
					kind: 'enum',
					options: ['not_asked', 'requested', 'approved', 'rejected'],
					required: true
				},
				{ key: 'form.plaque_spot', label: 'Where can the plaque go?', kind: 'text', max: 200 }
			]
		},
		{
			title: 'Sources (desk research)',
			fields: [
				{
					key: 'verification_method',
					label: 'How it was checked',
					kind: 'enum',
					options: E.verification_method,
					required: true
				},
				{
					key: 'source_urls',
					label: 'Source links (https, one per line, max 10)',
					kind: 'urls',
					max: 10
				}
			]
		},
		signoff(null, true, [{ key: 'form.notes', label: 'Anything else', kind: 'long' }]),
		record
	],
	repeats: [
		{
			key: 'hours',
			title: 'Opening hours (one row per weekday)',
			store: 'table',
			max: 14,
			cols: [
				{ key: 'weekday', label: 'Day', kind: 'weekday' },
				{ key: 'opens', label: 'Opens', kind: 'time' },
				{ key: 'closes', label: 'Closes', kind: 'time' },
				{ key: 'hours_unknown', label: 'Hours unknown', kind: 'bool' }
			]
		},
		{
			key: 'seasonal',
			title: 'Special seasons',
			store: 'table',
			max: 10,
			cols: [
				{ key: 'season', label: 'Season', kind: 'enum', options: E.season },
				{ key: 'from_month', label: 'From', kind: 'enum', options: MONTHS },
				{ key: 'to_month', label: 'To', kind: 'enum', options: MONTHS }
			]
		},
		{
			key: 'crowd',
			title: 'Typical crowd by day (planner)',
			store: 'table',
			max: 28,
			cols: [
				{ key: 'weekday', label: 'Day', kind: 'weekday' },
				{ key: 'season', label: 'Season (optional)', kind: 'text' },
				{ key: 'level', label: 'Crowd', kind: 'enum', options: E.crowd_level }
			]
		},
		{
			key: 'nearby_utilities',
			title: 'Useful places nearby (within 5 km, seen by you)',
			store: 'form',
			max: 30,
			cols: [
				{ key: 'type', label: 'Type', kind: 'enum', options: UTILITY_TYPES },
				{ key: 'name', label: 'Name', kind: 'text' },
				{ key: 'gps', label: 'GPS', kind: 'gps' },
				{ key: 'km', label: 'Distance km', kind: 'km' }
			]
		}
	],
	slots: [
		{ slot: 'hero', label: 'Main photo', min: 1, max: 1, name: 'hero', numbered: false },
		{ slot: 'card', label: 'Card photo', min: 1, max: 1, name: 'card', numbered: false },
		{
			slot: 'gallery',
			label: 'Extra photos (3–8)',
			min: 3,
			max: 8,
			name: 'gallery',
			numbered: true
		}
	]
};

// ---------------------------------------------------------------- stays
const stay: TypeDef = {
	type: 'stay',
	label: 'Stay',
	letter: 'S',
	recheckMonths: 3,
	sections: [
		{
			title: 'Basic details',
			fields: [
				{ key: 'code', label: 'Stay ID', kind: 'code', required: true, help: 'e.g. RTN-S-007' },
				...names({ mr: false }),
				{
					key: 'form.type',
					label: 'Type of stay',
					kind: 'enum',
					options: [
						'hotel',
						'homestay',
						'agro_tourism',
						'resort',
						'lodge',
						'dharamshala',
						'hostel'
					],
					required: true
				},
				{ key: 'taluka_id', label: 'Taluka', kind: 'taluka', required: true },
				{
					key: 'form.address',
					label: 'Full address (with pin code)',
					kind: 'long',
					required: true
				},
				{ key: 'gps', label: 'GPS (gate or reception)', kind: 'gps', required: true },
				{ key: 'form.landmark', label: 'Landmark', kind: 'text', max: 200 },
				{
					key: 'form.short_description',
					label: 'One-line description (cards)',
					kind: 'long',
					max: 150,
					required: true
				},
				...perLang('description', 'Description', 'long')
			]
		},
		{
			title: 'Contact and owner',
			fields: [
				...contact(true),
				{ key: 'form.email', label: 'Email', kind: 'email' },
				{ key: 'form.website', label: 'Website', kind: 'url' },
				{ key: 'form.instagram', label: 'Instagram', kind: 'url' },
				{ key: 'form.owner_languages', label: 'Languages owner speaks', kind: 'lines', max: 6 }
			]
		},
		{
			title: 'Photos',
			fields: [
				{
					key: 'form.photo_source',
					label: 'Who took the photos?',
					kind: 'enum',
					options: ['me', 'owner_checked_by_me'],
					required: true
				},
				{ key: 'form.photos_taken_on', label: 'Photos taken on', kind: 'date' }
			]
		},
		{
			title: 'Vibe and style',
			fields: [
				{
					key: 'vibe_tags',
					label: 'Vibe tags (max 4)',
					kind: 'multi',
					options: VIBES,
					max: 4,
					required: true
				},
				{
					key: 'service_style',
					label: 'Service style',
					kind: 'enum',
					options: E.service_style,
					required: true
				},
				{ key: 'form.style_notes', label: 'Style notes', kind: 'long' }
			]
		},
		{
			title: 'Rooms',
			fields: [
				{ key: 'form.total_rooms', label: 'Total rooms', kind: 'int', min: 0, required: true },
				{
					key: 'form.max_guests',
					label: 'Max guests in total',
					kind: 'int',
					min: 0,
					required: true
				},
				{ key: 'form.check_in', label: 'Check-in time', kind: 'time' },
				{ key: 'form.check_out', label: 'Check-out time', kind: 'time' }
			]
		},
		{
			title: 'Facilities (field form)',
			fields: [
				{
					key: 'form.ac',
					label: 'AC',
					kind: 'enum',
					options: ['all_rooms', 'some_rooms', 'none'],
					required: true
				},
				{
					key: 'form.hot_water',
					label: 'Hot water',
					kind: 'enum',
					options: ['24_hours', 'fixed_hours', 'on_request', 'none'],
					required: true
				},
				{ key: 'form.hot_water_hours', label: 'Hot water hours', kind: 'text', max: 40 },
				{ key: 'amenities.wifi', label: 'Wi-Fi?', kind: 'tri', required: true },
				{
					key: 'form.wifi_quality',
					label: 'Wi-Fi quality',
					kind: 'enum',
					options: ['good', 'basic', 'poor']
				},
				{
					key: 'form.power_backup',
					label: 'Power backup',
					kind: 'enum',
					options: ['full', 'partial', 'none'],
					required: true
				},
				{
					key: 'form.parking',
					label: 'Parking',
					kind: 'enum',
					options: ['car_and_bike', 'bike_only', 'street', 'none'],
					required: true
				},
				{ key: 'form.parking_paid', label: 'Paid parking?', kind: 'tri' },
				{ key: 'form.pets_allowed', label: 'Pets allowed?', kind: 'tri' },
				{ key: 'form.kids_friendly', label: 'Good for kids?', kind: 'tri' },
				{ key: 'form.elderly_friendly', label: 'Good for elderly?', kind: 'tri' },
				{ key: 'form.laundry', label: 'Laundry?', kind: 'tri' },
				{ key: 'form.tv', label: 'TV?', kind: 'tri' },
				{
					key: 'form.drinking_water',
					label: 'Drinking water',
					kind: 'enum',
					options: ['ro', 'bottled', 'well', 'none']
				},
				{ key: 'form.first_aid', label: 'First aid kit?', kind: 'tri' },
				{ key: 'form.cctv', label: 'CCTV?', kind: 'tri' },
				{ key: 'form.doctor_nearby', label: 'Doctor on call nearby?', kind: 'tri' },
				{
					key: 'form.net_jio',
					label: 'Jio network (inside room)',
					kind: 'enum',
					options: NET,
					required: true
				},
				{
					key: 'form.net_airtel',
					label: 'Airtel network',
					kind: 'enum',
					options: NET,
					required: true
				},
				{ key: 'form.net_vi', label: 'Vi network', kind: 'enum', options: NET, required: true },
				{ key: 'form.net_bsnl', label: 'BSNL network', kind: 'enum', options: NET, required: true }
			]
		},
		{
			title: 'Facilities shown in the app',
			fields: [
				...AMENITIES.filter((a) => a !== 'wifi').map((a) => ({
					key: `amenities.${a}`,
					label: `Has ${a.replace(/_/g, ' ')}`,
					kind: 'tri' as const
				})),
				...OPERATORS.map((o) => ({
					key: `network_strength.${o}`,
					label: `${o} signal (app)`,
					kind: 'enum' as const,
					options: ['none', 'weak', 'good']
				}))
			]
		},
		{
			title: 'Distances',
			fields: [
				{ key: 'form.beach_name', label: 'Nearest beach', kind: 'text', max: 120 },
				{ key: 'form.beach_km', label: 'Beach distance (km)', kind: 'km' },
				{ key: 'form.beach_walk_min', label: 'Walk to beach (minutes)', kind: 'int', min: 0 },
				{ key: 'form.bus_stop_km', label: 'Bus stop distance (km)', kind: 'km' },
				{ key: 'form.railway_km', label: 'Railway station distance (km)', kind: 'km' },
				{ key: 'form.hospital_km', label: 'Hospital distance (km)', kind: 'km' }
			]
		},
		{
			title: 'Food at the stay',
			fields: [
				{ key: 'form.food_served', label: 'Food served?', kind: 'tri', required: true },
				...STAY_FOOD.map((k) => ({
					key: `food_at_stay.${k}`,
					label: k === 'homemade_included' ? 'Homemade food?' : `${k.replace(/_/g, '-')} food?`,
					kind: 'tri' as const
				})),
				{ key: 'form.cuisines', label: 'Type of food (one per line)', kind: 'lines', max: 10 },
				{
					key: 'form.meals_included',
					label: 'Meals included in price',
					kind: 'enum',
					options: ['none', 'breakfast', 'breakfast_and_dinner', 'all_meals'],
					required: true
				},
				{ key: 'form.extra_meal_cost', label: 'Extra meal cost per person (₹)', kind: 'money' },
				{ key: 'form.seafood_note', label: 'Seafood note', kind: 'long' }
			]
		},
		{
			title: 'Price (from the owner)',
			fields: [
				{
					key: 'form.price_basis',
					label: 'Price is for',
					kind: 'enum',
					options: ['per_room_per_night', 'per_person_per_night'],
					required: true
				},
				{ key: 'price_min', label: 'Normal season — lowest (₹)', kind: 'money', required: true },
				{ key: 'price_max', label: 'Normal season — highest (₹)', kind: 'money', required: true },
				{ key: 'form.peak_min', label: 'Peak season — lowest (₹)', kind: 'money' },
				{ key: 'form.peak_max', label: 'Peak season — highest (₹)', kind: 'money' },
				{ key: 'form.peak_months', label: 'Peak months', kind: 'months' },
				{ key: 'form.price_includes', label: 'Price includes', kind: 'text', max: 200 },
				{
					key: 'form.price_source',
					label: 'Where is the price from? (form)',
					kind: 'enum',
					options: ['owner', 'board_at_reception'],
					required: true
				},
				{
					key: 'price_source',
					label: 'Price label in the app',
					kind: 'enum',
					options: E.price_source
				},
				{ key: 'form.price_date', label: 'Price collected on', kind: 'date', required: true }
			]
		},
		{
			title: 'Booking and payment',
			fields: [
				{ key: 'form.book_by_phone', label: 'Book by phone call?', kind: 'tri' },
				{ key: 'form.book_by_whatsapp', label: 'Book on WhatsApp?', kind: 'tri' },
				{ key: 'form.advance_required', label: 'Advance payment needed?', kind: 'tri' },
				{ key: 'form.payment_modes', label: 'Payment modes', kind: 'multi', options: PAY },
				{ key: 'form.cancellation', label: 'Cancellation rule', kind: 'long' }
			]
		},
		{
			title: 'House rules',
			fields: [
				{
					key: 'form.unmarried_couples',
					label: 'Unmarried couples allowed?',
					kind: 'enum',
					options: YES_NO_ASK
				},
				{ key: 'form.alcohol', label: 'Alcohol allowed?', kind: 'tri' },
				{ key: 'form.smoking', label: 'Smoking allowed?', kind: 'tri' },
				{ key: 'form.id_required', label: 'ID proof needed?', kind: 'tri' },
				{ key: 'form.quiet_hours', label: 'Quiet hours', kind: 'text', max: 40 },
				{ key: 'form.other_rules', label: 'Other rules (one per line)', kind: 'lines', max: 20 }
			]
		},
		signoff('is_verified', true, [
			{ key: 'form.notes', label: 'Anything else', kind: 'long' },
			{
				key: 'private.internal_notes',
				label: 'Team-only notes',
				kind: 'long',
				private: true
			}
		]),
		record
	],
	repeats: [
		{
			key: 'room_types',
			title: 'Room types',
			store: 'form',
			max: 20,
			cols: [
				{ key: 'name', label: 'Room name', kind: 'text' },
				{ key: 'count', label: 'How many', kind: 'int' },
				{ key: 'max_guests', label: 'Max guests', kind: 'int' },
				{ key: 'ac', label: 'AC?', kind: 'tri' },
				{ key: 'own_bathroom', label: 'Own bathroom?', kind: 'tri' },
				{ key: 'beds', label: 'Beds', kind: 'text' }
			]
		},
		{
			key: 'offers',
			title: 'Booking links (no scraping; affiliate deep links later)',
			store: 'table',
			max: 10,
			cols: [
				{ key: 'provider', label: 'Site', kind: 'enum', options: OFFER_PROVIDERS },
				{ key: 'deep_link', label: 'Link (https)', kind: 'url' }
			]
		}
	],
	slots: [
		{ slot: 'cover', label: 'Cover photo (4:3)', min: 1, max: 1, name: 'cover', numbered: false },
		{ slot: 'rooms', label: 'Rooms (2–4)', min: 2, max: 4, name: 'room', numbered: true },
		{ slot: 'bathroom', label: 'Bathroom', min: 1, max: 4, name: 'bath', numbered: true },
		{ slot: 'outside', label: 'Outside / view (1–3)', min: 0, max: 3, name: 'ext', numbered: true },
		{ slot: 'food', label: 'Food (0–2)', min: 0, max: 2, name: 'food', numbered: true }
	]
};

// ---------------------------------------------------------------- eateries
const eatery: TypeDef = {
	type: 'eatery',
	label: 'Eatery',
	letter: 'F',
	recheckMonths: 3,
	sections: [
		{
			title: 'Basic details',
			fields: [
				{ key: 'code', label: 'Eatery ID', kind: 'code', required: true, help: 'e.g. RTN-F-012' },
				...names({ mr: false }),
				{
					key: 'form.type',
					label: 'Type of eatery',
					kind: 'enum',
					options: [
						'restaurant',
						'thali_house',
						'home_kitchen',
						'stall',
						'cafe',
						'dhaba',
						'sweet_shop',
						'bakery',
						'juice_centre'
					],
					required: true
				},
				{ key: 'taluka_id', label: 'Taluka', kind: 'taluka', required: true },
				{
					key: 'form.address',
					label: 'Full address (with pin code)',
					kind: 'long',
					required: true
				},
				{ key: 'gps', label: 'GPS (entrance)', kind: 'gps', required: true },
				{ key: 'form.landmark', label: 'Landmark', kind: 'text', max: 200 },
				{
					key: 'form.short_description',
					label: 'One-line description (cards)',
					kind: 'long',
					max: 150,
					required: true
				},
				...perLang('description', 'Description', 'long'),
				{ key: 'form.years_running', label: 'Running for (years)', kind: 'int', min: 0 }
			]
		},
		{
			title: 'Contact and owner',
			fields: [...contact(false), { key: 'form.instagram', label: 'Instagram', kind: 'url' }]
		},
		{
			title: 'Photos',
			fields: [{ key: 'form.photos_taken_on', label: 'Photos taken on', kind: 'date' }]
		},
		{
			title: 'Authenticity',
			fields: [
				{
					key: 'authenticity',
					label: 'Authenticity',
					kind: 'enum',
					options: E.eatery_authenticity,
					required: true
				},
				{ key: 'form.authenticity_reason', label: 'Why this tag?', kind: 'long', required: true },
				{
					key: 'form.cuisines',
					label: 'Type of food (one per line)',
					kind: 'lines',
					max: 10,
					required: true
				},
				{ key: 'vibe_tags', label: 'Vibe tags', kind: 'lines', max: 9 }
			]
		},
		{
			title: 'Menu and price',
			fields: [
				{
					key: 'form.food_type',
					label: 'Food served',
					kind: 'enum',
					options: ['veg_only', 'veg_and_non_veg', 'mostly_non_veg'],
					required: true
				},
				...DIETS.map((d) => ({
					key: `diet_flags.${d}`,
					label:
						d === 'jain' ? 'Jain food available?' : d === 'veg' ? 'Veg food?' : 'Non-veg food?',
					kind: 'tri' as const,
					required: d === 'jain'
				})),
				{ key: 'price_for_two', label: 'Price for two (₹)', kind: 'money', required: true },
				{ key: 'form.thali_available', label: 'Thali available?', kind: 'tri' },
				{ key: 'form.daily_catch', label: 'Fish price changes daily?', kind: 'tri' },
				{ key: 'form.alcohol_served', label: 'Alcohol served?', kind: 'tri' },
				{ key: 'form.payment_modes', label: 'Payment modes', kind: 'multi', options: PAY },
				{ key: 'form.menu_date', label: 'Menu collected on', kind: 'date', required: true },
				{
					key: 'menu.items',
					label: 'Menu lines shown in the app (one per line)',
					kind: 'lines',
					max: 40
				}
			]
		},
		{
			title: 'Timings and visit details',
			fields: [
				{
					key: 'form.hours_known',
					label: 'Do we know the timings?',
					kind: 'tri',
					required: true,
					help: 'No = excluded from “Open now”.'
				},
				{ key: 'form.closed_days', label: 'Closed on', kind: 'multi', options: WEEKDAYS },
				{ key: 'form.seasonal_closure', label: 'Closed in any season?', kind: 'text', max: 200 },
				{
					key: 'service_style',
					label: 'Service style',
					kind: 'enum',
					options: E.service_style,
					required: true
				},
				{ key: 'form.seating_capacity', label: 'Seats', kind: 'int', min: 0 },
				{ key: 'form.ac_section', label: 'AC section?', kind: 'tri' },
				{ key: 'form.family_section', label: 'Family section?', kind: 'tri' },
				{ key: 'form.outdoor_seating', label: 'Outdoor seating?', kind: 'tri' },
				{
					key: 'form.parking',
					label: 'Parking',
					kind: 'enum',
					options: ['car_and_bike', 'bike_only', 'street', 'none']
				},
				{ key: 'form.toilet', label: 'Toilet?', kind: 'tri' },
				{
					key: 'form.drinking_water',
					label: 'Drinking water',
					kind: 'enum',
					options: ['ro', 'bottled', 'none']
				},
				{ key: 'form.kids_friendly', label: 'Good for kids?', kind: 'tri' },
				{ key: 'form.wheelchair_ok', label: 'Wheelchair friendly?', kind: 'tri' },
				{ key: 'form.takeaway', label: 'Takeaway?', kind: 'tri' },
				{ key: 'form.advance_order', label: 'Need to order in advance?', kind: 'tri' },
				{ key: 'form.advance_order_note', label: 'Advance order note', kind: 'text', max: 200 },
				{
					key: 'form.peak_wait',
					label: 'Wait at busy time',
					kind: 'enum',
					options: ['none', 'short', 'long']
				}
			]
		},
		{
			title: 'Delivery apps',
			fields: [
				...FOOD_APPS.flatMap((a) => [
					{
						key: `food_apps.${a}.available`,
						label: `On ${a[0]!.toUpperCase()}${a.slice(1)}?`,
						kind: 'tri' as const,
						required: a === 'swiggy' || a === 'zomato'
					},
					{ key: `food_apps.${a}.link`, label: `${a} page link`, kind: 'url' as const }
				]),
				{
					key: 'form.other_apps',
					label: 'Other apps and links (one per line)',
					kind: 'lines',
					max: 10
				},
				{ key: 'form.delivery_checked_on', label: 'Checked on', kind: 'date', required: true }
			]
		},
		signoff('is_verified', true, [
			{
				key: 'private.internal_notes',
				label: 'Team-only notes',
				kind: 'long',
				private: true,
				help: 'e.g. hygiene concerns. Never shown in the app.'
			}
		]),
		record
	],
	repeats: [
		{
			key: 'hours',
			title: 'Opening times (one row per day and period; lunch + dinner = 2 rows)',
			store: 'table',
			max: 21,
			cols: [
				{ key: 'weekday', label: 'Day', kind: 'weekday' },
				{ key: 'opens', label: 'Opens', kind: 'time' },
				{ key: 'closes', label: 'Closes', kind: 'time' },
				{ key: 'hours_unknown', label: 'Hours unknown', kind: 'bool' }
			]
		},
		{
			key: 'links',
			title: 'Signature dishes (dish guide, max 4 signature)',
			store: 'table',
			max: 10,
			cols: [
				{ key: 'dish_id', label: 'Dish', kind: 'dish' },
				{ key: 'is_signature', label: 'Signature', kind: 'bool' },
				{ key: 'is_best_for', label: 'Best place for it', kind: 'bool' },
				{ key: 'note', label: 'Why here?', kind: 'text' }
			]
		},
		{
			key: 'menu_items',
			title: 'Menu items (top 10–20)',
			store: 'form',
			max: 40,
			cols: [
				{ key: 'name', label: 'Item name', kind: 'text' },
				{ key: 'price', label: 'Price ₹', kind: 'money' },
				{ key: 'type', label: 'Type', kind: 'enum', options: ITEM_TYPE },
				{ key: 'dish_id', label: 'Dish (if in guide)', kind: 'dish' }
			]
		}
	],
	slots: [
		{
			slot: 'cover',
			label: 'Cover (signature dish or front, 4:3)',
			min: 1,
			max: 1,
			name: 'cover',
			numbered: false
		},
		{ slot: 'dishes', label: 'Dishes (2–5)', min: 2, max: 5, name: 'dish', numbered: true },
		{ slot: 'inside', label: 'Inside (1–2)', min: 0, max: 2, name: 'int', numbered: true },
		{ slot: 'outside', label: 'Outside / signboard', min: 1, max: 2, name: 'ext', numbered: true },
		{ slot: 'menu', label: 'Menu pages', min: 0, max: 20, name: 'menu', numbered: true }
	]
};

// ---------------------------------------------------------------- dishes
const dish: TypeDef = {
	type: 'dish',
	label: 'Dish',
	letter: null,
	recheckMonths: null,
	sections: [
		{
			title: 'Dish details',
			fields: [
				{ key: 'code', label: 'Dish ID', kind: 'code', required: true, help: 'e.g. DISH-001' },
				...names({ mr: true }),
				{
					key: 'form.other_spellings',
					label: 'Other spellings (one per line)',
					kind: 'lines',
					max: 10
				},
				{
					key: 'form.category',
					label: 'Dish category',
					kind: 'enum',
					options: [
						'main',
						'thali',
						'curry',
						'fry',
						'snack',
						'rice_or_bread',
						'sweet',
						'drink',
						'pickle_or_side'
					],
					required: true
				},
				{ key: 'form.veg_type', label: 'Type', kind: 'enum', options: ITEM_TYPE, required: true }
			]
		},
		{
			title: 'About the dish',
			fields: [
				...perLang('what_it_is', 'What is it?', 'long', true),
				{ key: 'form.ingredients', label: 'Main ingredients', kind: 'long', required: true },
				{ key: 'form.taste', label: 'Taste', kind: 'text', max: 200, required: true },
				{
					key: 'form.spice_level',
					label: 'Spice level',
					kind: 'enum',
					options: ['mild', 'medium', 'hot'],
					required: true
				},
				{ key: 'form.how_to_eat', label: 'How to eat it', kind: 'long' },
				{
					key: 'form.best_time_to_eat',
					label: 'Best time to eat',
					kind: 'enum',
					options: ['breakfast', 'lunch', 'dinner', 'snack', 'any']
				},
				{ key: 'form.season', label: 'Season (months available)', kind: 'months' },
				{ key: 'form.festival', label: 'Linked festival', kind: 'text', max: 120 },
				...perLang('story', 'Story', 'long'),
				{ key: 'form.story_notes', label: 'Story or culture notes (rough)', kind: 'long' },
				{
					key: 'private.source_notes',
					label: 'Who told you?',
					kind: 'long',
					private: true,
					required: true
				}
			]
		},
		{
			title: 'Price',
			fields: [
				{ key: 'form.price_min', label: 'Usual price — lowest (₹)', kind: 'money' },
				{ key: 'form.price_max', label: 'Usual price — highest (₹)', kind: 'money' },
				{
					key: 'form.price_unit',
					label: 'Price per',
					kind: 'enum',
					options: ['plate', 'glass', 'piece', 'thali']
				}
			]
		},
		signoff(null, false, [], 'Written by'),
		record
	],
	repeats: [
		{
			key: 'links',
			title: 'Where it’s best (at least 1 eatery)',
			store: 'table',
			min: 1,
			max: 20,
			cols: [
				{ key: 'eatery_id', label: 'Eatery', kind: 'eatery' },
				{ key: 'is_signature', label: 'Signature there', kind: 'bool' },
				{ key: 'is_best_for', label: 'Best place for it', kind: 'bool' },
				{ key: 'note', label: 'Why here?', kind: 'text' }
			]
		}
	],
	slots: [{ slot: 'dish', label: 'Dish photos (1–3)', min: 1, max: 3, name: '', numbered: true }]
};

export const DEFS: Record<EntryType, TypeDef> = { place, stay, eatery, dish };

export const allFields = (t: EntryType) => DEFS[t].sections.flatMap((s) => s.fields);
export const fieldByKey = (t: EntryType, key: string) => allFields(t).find((f) => f.key === key);

/** Template file name for a photo: <CODE>_<name>[NN].jpg (DISH-001_01.jpg); null until the ID is set. */
export function photoFileName(code: string | null, s: Slot, index: number) {
	if (!code) return null;
	const n = String(index + 1).padStart(2, '0');
	const tail = s.numbered ? `${s.name}${n}` : s.name;
	return `${code}_${tail}.jpg`;
}

export const STATUS_LABEL = {
	draft: 'Draft',
	in_review: 'Ready for review',
	published: 'Approved'
} as const;
