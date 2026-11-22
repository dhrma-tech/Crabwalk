import type { L } from '../i18n.ts';

// The nine talukas (reference landing.dc.html `talukaData`). Region lives in data, not logic (CLAUDE.md §2): another
// district is another file like this one plus its own generated geometry.
export type TalukaKey =
	| 'mandangad'
	| 'dapoli'
	| 'khed'
	| 'chiplun'
	| 'guhagar'
	| 'sangameshwar'
	| 'ratnagiri'
	| 'lanja'
	| 'rajapur';

export type Taluka = { key: TalukaKey; name: L; desc: L; spots: L[]; stamp: string };

const t = (en: string, hi: string, mr: string): L => ({ en, hi, mr });

export const DISTRICT = { name: t('Ratnagiri', 'रत्नागिरी', 'रत्नागिरी'), defaultTaluka: 'ratnagiri' as TalukaKey };

export const TALUKAS: Taluka[] = [
	{
		key: 'mandangad',
		name: t('Mandangad', 'मंडणगड', 'मंडणगड'),
		desc: t(
			'The quiet northern tip, where olive ridley turtles nest each spring.',
			'शांत उत्तरी छोर, जहाँ हर वसंत में ऑलिव रिडले कछुए अंडे देते हैं।',
			'शांत उत्तरेकडचं टोक, जिथे दर वसंतात ऑलिव्ह रिडले कासवं अंडी घालतात.'
		),
		spots: [t('Velas turtle beach', 'वेलास कछुआ तट', 'वेळास कासव किनारा'), t('Bankot fort', 'बाणकोट किला', 'बाणकोट किल्ला')],
		stamp: 'turtle'
	},
	{
		key: 'dapoli',
		name: t('Dapoli', 'दापोली', 'दापोली'),
		desc: t(
			'Long beaches, a sea fort and cool hill air.',
			'लंबे समुद्र तट, एक समुद्री किला और ठंडी पहाड़ी हवा।',
			'लांबलचक किनारे, एक जलदुर्ग आणि थंड डोंगरी हवा.'
		),
		spots: [
			t('Murud beach', 'मुरुड तट', 'मुरुड किनारा'),
			t('Harnai', 'हर्णे', 'हर्णे'),
			t('Suvarnadurg sea fort', 'सुवर्णदुर्ग समुद्री किला', 'सुवर्णदुर्ग जलदुर्ग'),
			t('Ladghar', 'लाडघर', 'लाडघर')
		],
		stamp: 'seafort'
	},
	{
		key: 'khed',
		name: t('Khed', 'खेड', 'खेड'),
		desc: t(
			'Ghat roads and hill forts on the Sahyadri edge.',
			'सह्याद्री के किनारे घाट की सड़कें और पहाड़ी किले।',
			'सह्याद्रीच्या कडेला घाटरस्ते आणि डोंगरी किल्ले.'
		),
		spots: [t('Rasalgad fort', 'रसालगढ़ किला', 'रसाळगड किल्ला'), t('Ghat viewpoints', 'घाट व्यू पॉइंट', 'घाटातले व्ह्यू पॉइंट')],
		stamp: 'ghat'
	},
	{
		key: 'chiplun',
		name: t('Chiplun', 'चिपलूण', 'चिपळूण'),
		desc: t(
			'River town on the Vashishti, gateway to the ghats.',
			'वाशिष्ठी नदी पर बसा शहर, घाटों का प्रवेश द्वार।',
			'वाशिष्ठीच्या काठचं गाव, घाटांचं प्रवेशद्वार.'
		),
		spots: [t('Parshuram temple', 'परशुराम मंदिर', 'परशुराम मंदिर'), t('Vashishti river', 'वाशिष्ठी नदी', 'वाशिष्ठी नदी')],
		stamp: 'river'
	},
	{
		key: 'guhagar',
		name: t('Guhagar', 'गुहागर', 'गुहागर'),
		desc: t(
			'Clean, calm beaches and old coastal temples.',
			'साफ़, शांत तट और पुराने तटीय मंदिर।',
			'स्वच्छ, शांत किनारे आणि जुनी किनारी मंदिरं.'
		),
		spots: [t('Guhagar beach', 'गुहागर तट', 'गुहागर किनारा'), t('Velneshwar', 'वेलणेश्वर', 'वेळणेश्वर'), t('Hedvi', 'हेदवी', 'हेदवी')],
		stamp: 'temple'
	},
	{
		key: 'sangameshwar',
		name: t('Sangameshwar', 'संगमेश्वर', 'संगमेश्वर'),
		desc: t(
			'Where rivers meet, with cave temples and monsoon falls.',
			'जहाँ नदियाँ मिलती हैं, गुफा मंदिरों और बरसाती झरनों के साथ।',
			'जिथे नद्या भेटतात, गुहा मंदिरं आणि पावसाळी धबधबे.'
		),
		spots: [
			t('Marleshwar temple and falls', 'मार्लेश्वर मंदिर और झरना', 'मार्लेश्वर मंदिर आणि धबधबा'),
			t('Karneshwar temple', 'कर्णेश्वर मंदिर', 'कर्णेश्वर मंदिर')
		],
		stamp: 'falls'
	},
	{
		key: 'ratnagiri',
		name: t('Ratnagiri', 'रत्नागिरी', 'रत्नागिरी'),
		desc: t(
			'The heart of the coast: forts, beaches, mango orchards and the city.',
			'तट का दिल: किले, समुद्र तट, आम के बाग़ और शहर।',
			'किनाऱ्याचं हृदय: किल्ले, किनारे, आंब्याच्या बागा आणि शहर.'
		),
		spots: [
			t('Ganpatipule', 'गणपतिपुळे', 'गणपतीपुळे'),
			t('Jaigad Fort', 'जयगढ़ किला', 'जयगड किल्ला'),
			t('Ratnadurg', 'रत्नदुर्ग', 'रत्नदुर्ग'),
			t('Thibaw Palace', 'थीबा पैलेस', 'थिबा राजवाडा'),
			t('Pawas', 'पावस', 'पावस')
		],
		stamp: 'lighthouse'
	},
	{
		key: 'lanja',
		name: t('Lanja', 'लांजा', 'लांजा'),
		desc: t(
			'Inland villages and plateaus, far from the beach crowds.',
			'भीतरी गाँव और पठार, समुद्र तट की भीड़ से दूर।',
			'आतली गावं आणि सडे, किनाऱ्यावरच्या गर्दीपासून दूर.'
		),
		spots: [t('Village trails', 'गाँव की पगडंडियाँ', 'गावातल्या पायवाटा'), t('Orchard stays', 'बाग़ में ठहराव', 'बागेतले मुक्काम')],
		stamp: 'mango'
	},
	{
		key: 'rajapur',
		name: t('Rajapur', 'राजापुर', 'राजापूर'),
		desc: t(
			'The southern stretch, with hot springs and riverside temples.',
			'दक्षिणी हिस्सा, गर्म झरनों और नदी किनारे के मंदिरों के साथ।',
			'दक्षिणेकडचा पट्टा, गरम पाण्याचे झरे आणि नदीकाठची मंदिरं.'
		),
		spots: [
			t('Unhale hot springs', 'उन्हाळे गर्म झरने', 'उन्हाळे गरम पाण्याचे झरे'),
			t('Dhoot-Papeshwar temple', 'धूतपापेश्वर मंदिर', 'धूतपापेश्वर मंदिर')
		],
		stamp: 'spring'
	}
];

/** The 12 labelled places on the map. Coordinates: the repo's own OSM-sourced place data (data/places/*.yaml);
 *  Unhale and Ratnagiri city are town centres. `side` = which margin the leader line runs to. */
export const MAP_PLACES: { name: L; lon: number; lat: number; side: 'w' | 'e'; main?: boolean }[] = [
	{ name: t('Velas', 'वेलास', 'वेळास'), lon: 73.0314, lat: 17.9565, side: 'w' },
	{ name: t('Suvarnadurg', 'सुवर्णदुर्ग', 'सुवर्णदुर्ग'), lon: 73.0845, lat: 17.8169, side: 'w' },
	{ name: t('Rasalgad', 'रसालगढ़', 'रसाळगड'), lon: 73.5121, lat: 17.7645, side: 'e' },
	{ name: t('Parshuram', 'परशुराम', 'परशुराम'), lon: 73.5049, lat: 17.5557, side: 'e' },
	{ name: t('Velneshwar', 'वेलणेश्वर', 'वेळणेश्वर'), lon: 73.211, lat: 17.3786, side: 'w' },
	{ name: t('Jaigad Fort', 'जयगढ़ किला', 'जयगड किल्ला'), lon: 73.2213, lat: 17.3011, side: 'w' },
	{ name: t('Ganpatipule', 'गणपतिपुळे', 'गणपतीपुळे'), lon: 73.2653, lat: 17.1469, side: 'w' },
	{ name: t('Marleshwar', 'मार्लेश्वर', 'मार्लेश्वर'), lon: 73.736, lat: 17.0745, side: 'e' },
	{ name: t('Ratnagiri city', 'रत्नागिरी शहर', 'रत्नागिरी शहर'), lon: 73.3, lat: 16.99, side: 'w', main: true },
	{ name: t('Pawas', 'पावस', 'पावस'), lon: 73.3288, lat: 16.8664, side: 'w' },
	{ name: t('Unhale springs', 'उन्हाळे झरने', 'उन्हाळे झरे'), lon: 73.533, lat: 16.668, side: 'e' },
	{ name: t('Dhoot-Papeshwar', 'धूतपापेश्वर', 'धूतपापेश्वर'), lon: 73.4982, lat: 16.6489, side: 'e' }
];
