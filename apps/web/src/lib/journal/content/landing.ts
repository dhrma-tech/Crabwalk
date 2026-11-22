import type { L } from '../i18n.ts';

// All landing copy (reference landing.dc.html), in page order. Placeholders in brackets stay until real data
// exists (brief §4). HI/MR: drafts for native review.
const t = (en: string, hi: string, mr: string): L => ({ en, hi, mr });

export const NAV = {
	home: t('Crabwalk home', 'क्रैबवॉक होम', 'क्रॅबवॉक मुख्यपान'),
	main: t('Main', 'मुख्य', 'मुख्य'),
	links: [
		{ label: t('Discover', 'खोजें', 'शोधा'), href: '/discover' },
		{ label: t('Map', 'नक्शा', 'नकाशा'), href: '/map' },
		{ label: t('Plan', 'प्लान', 'प्लॅन'), href: '/plan/new' },
		{ label: t('Taste Konkan', 'कोंकण का स्वाद', 'कोकणची चव'), href: '/taste-konkan' },
		{ label: t('Stays', 'ठहरने की जगहें', 'मुक्काम'), href: '/stays' }
	],
	language: t('Language', 'भाषा', 'भाषा'),
	signIn: t('Sign in', 'साइन इन', 'साइन इन'),
	menu: t('Menu', 'मेनू', 'मेनू'),
	close: t('Close menu', 'मेनू बंद करें', 'मेनू बंद करा')
};

export const HERO = {
	eyebrow: t('The Konkan coast, verified on foot', 'कोंकण तट, पैदल जाँचा हुआ', 'कोकण किनारा, पायी तपासलेला'),
	deva: 'रत्नागिरी',
	title: 'Ratnagiri',
	sub: t(
		'Sea forts, red-earth cliffs and kitchens the locals swear by. Every spot walked by our team, rated by how it actually feels.',
		'समुद्री किले, लाल मिट्टी की चट्टानें और वे रसोइयाँ जिन पर स्थानीय लोग भरोसा करते हैं। हर जगह हमारी टीम ने खुद देखी, और उसे वैसा ही आँका जैसा वह सच में लगती है।',
		'जलदुर्ग, लाल मातीचे कडे आणि स्थानिक ज्यांची शपथ घेतात अशी स्वयंपाकघरं. प्रत्येक ठिकाण आमच्या टीमने पायी पाहिलं, आणि ते खरंच कसं वाटतं त्यावरून मत दिलं.'
	),
	routeLabel: t('Coastal route from Jaigad to Pawas', 'जयगढ़ से पावस तक तटीय रास्ता', 'जयगड ते पावस किनारी मार्ग'),
	route: [
		t('Jaigad', 'जयगढ़', 'जयगड'),
		t('Ganpatipule', 'गणपतिपुळे', 'गणपतीपुळे'),
		t('Aare Ware', 'आरे वारे', 'आरे वारे'),
		t('Ratnadurg', 'रत्नदुर्ग', 'रत्नदुर्ग'),
		t('Bhatye', 'भाट्ये', 'भाट्ये'),
		t('Pawas', 'पावस', 'पावस')
	],
	tag: t('9 talukas · 3 languages · 1 coast', '9 तालुके · 3 भाषाएँ · 1 तट', '9 तालुके · 3 भाषा · 1 किनारा'),
	photo: t(
		'Photo slot · Aare Ware coastal road at golden hour',
		'फ़ोटो स्लॉट · सुनहरे समय में आरे वारे तटीय सड़क',
		'फोटो जागा · सोनेरी वेळी आरे वारे किनारी रस्ता'
	),
	sky: {
		dawn: t('Dawn in Ratnagiri', 'रत्नागिरी में भोर', 'रत्नागिरीत पहाट'),
		day: t('Daytime in Ratnagiri', 'रत्नागिरी में दिन', 'रत्नागिरीत दिवस'),
		golden: t('Golden hour in Ratnagiri', 'रत्नागिरी में सुनहरा समय', 'रत्नागिरीत सोनेरी वेळ'),
		night: t('Night in Ratnagiri', 'रत्नागिरी में रात', 'रत्नागिरीत रात्र')
	},
	scroll: t('Scroll to the Ratnagiri map', 'रत्नागिरी नक्शे तक जाएँ', 'रत्नागिरी नकाशाकडे जा')
};

export const MAP = {
	title: t('Discover Ratnagiri', 'रत्नागिरी खोजें', 'रत्नागिरी शोधा'),
	body: t(
		'Nine talukas between the Sahyadri and the Arabian Sea. Pick one to see what our team has walked, mapped and verified there.',
		'सह्याद्री और अरब सागर के बीच नौ तालुके। एक चुनें और देखें कि हमारी टीम ने वहाँ क्या चला, नक्शे पर लगाया और जाँचा है।',
		'सह्याद्री आणि अरबी समुद्राच्या मधले नऊ तालुके. एक निवडा आणि आमच्या टीमने तिथे काय फिरून, नकाशावर नोंदवून तपासलंय ते पाहा.'
	),
	pick: t('Choose a taluka', 'तालुका चुनें', 'तालुका निवडा'),
	explore: t('Explore {name} · [n] verified places', '{name} देखें · [n] जाँची हुई जगहें', '{name} पाहा · [n] तपासलेली ठिकाणं'),
	aria: t(
		'Map of Ratnagiri district and its nine talukas, with {name} highlighted',
		'रत्नागिरी ज़िले और उसके नौ तालुकों का नक्शा, {name} चिह्नित',
		'रत्नागिरी जिल्हा आणि नऊ तालुक्यांचा नकाशा, {name} ठळक'
	),
	sea: t('Arabian Sea', 'अरब सागर', 'अरबी समुद्र'),
	north: 'N',
	source: t('Boundaries © OpenStreetMap contributors', 'सीमाएँ © OpenStreetMap योगदानकर्ता', 'सीमा © OpenStreetMap योगदानकर्ते'),
	stamp: t('Verified on foot', 'पैदल जाँचा', 'पायी तपासलं')
};

export const CATS = {
	eyebrow: t('Discover', 'खोजें', 'शोधा'),
	title: t('Eleven ways into the coast', 'तट तक पहुँचने के ग्यारह रास्ते', 'किनाऱ्याकडे जाण्याच्या अकरा वाटा'),
	body: t(
		'Beaches to orchards, each with its story, timings, entry fee, tide window and monsoon status.',
		'समुद्र तट से बाग़ों तक, हर जगह की कहानी, समय, प्रवेश शुल्क, ज्वार का समय और मानसून की स्थिति के साथ।',
		'किनाऱ्यांपासून बागांपर्यंत, प्रत्येकाची गोष्ट, वेळा, प्रवेश शुल्क, भरती-ओहोटीची वेळ आणि पावसाळ्यातली स्थिती.'
	),
	count: t('[n] verified places', '[n] जाँची हुई जगहें', '[n] तपासलेली ठिकाणं'),
	see: t('See all {name}', 'सभी {name} देखें', 'सर्व {name} पाहा')
};

export const GEMS_COPY = {
	eyebrow: t('Hidden gems', 'छिपे रत्न', 'लपलेली रत्नं'),
	title: t('The quiet side of Ratnagiri', 'रत्नागिरी का शांत पहलू', 'रत्नागिरीची शांत बाजू'),
	filter: t('Filter by taluka', 'तालुके से छाँटें', 'तालुक्यानुसार निवडा'),
	all: t('All talukas', 'सभी तालुके', 'सर्व तालुके'),
	viewAll: t('View all', 'सभी देखें', 'सर्व पाहा'),
	prev: t('Previous place', 'पिछली जगह', 'मागचं ठिकाण'),
	next: t('Next place', 'अगली जगह', 'पुढचं ठिकाण'),
	pause: t('Pause slideshow', 'स्लाइडशो रोकें', 'स्लाइडशो थांबवा'),
	play: t('Play slideshow', 'स्लाइडशो चलाएँ', 'स्लाइडशो चालू करा'),
	badge: t('Hidden gem', 'छिपा रत्न', 'लपलेलं रत्न'),
	votes: t('[n] votes', '[n] वोट', '[n] मतं'),
	open: t('Open {name}', '{name} खोलें', '{name} उघडा'),
	show: t('Show {name}', '{name} दिखाएँ', '{name} दाखवा'),
	region: t('Hidden gems carousel', 'छिपे रत्नों का कैरोसेल', 'लपलेल्या रत्नांचा कॅरोसेल'),
	sample: t('Sample split until votes arrive', 'वोट आने तक नमूना', 'मतं येईपर्यंत नमुना')
};

export const WHY = {
	eyebrow: t('Why Crabwalk', 'क्रैबवॉक क्यों', 'क्रॅबवॉक का'),
	title: t(
		'One place for the whole trip. Built here, checked here.',
		'पूरी यात्रा के लिए एक जगह। यहीं बना, यहीं जाँचा।',
		'संपूर्ण सहलीसाठी एक जागा. इथेच बनवलं, इथेच तपासलं.'
	),
	mapTitle: t(
		"A map that works where the network doesn't",
		'ऐसा नक्शा जो वहाँ भी चले जहाँ नेटवर्क न हो',
		'नेटवर्क नसतानाही चालणारा नकाशा'
	),
	mapBody: t(
		'Every place, hotel and homestay on one map. Download a taluka pack once and fuel, ATMs, hospitals, ferry jetties, ghat warnings and tide windows stay on your phone.',
		'हर जगह, होटल और होमस्टे एक ही नक्शे पर। एक बार तालुका पैक डाउनलोड करें, फिर पेट्रोल पंप, एटीएम, अस्पताल, फ़ेरी घाट, घाट की चेतावनियाँ और ज्वार का समय आपके फ़ोन पर रहेंगे।',
		'प्रत्येक ठिकाण, हॉटेल आणि होमस्टे एकाच नकाशावर. एकदा तालुका पॅक डाउनलोड करा, मग पेट्रोल पंप, एटीएम, दवाखाने, फेरी धक्के, घाटातले इशारे आणि भरती-ओहोटीच्या वेळा तुमच्या फोनवर राहतात.'
	),
	layers: [
		t('Places', 'जगहें', 'ठिकाणं'),
		t('Stays', 'ठहराव', 'मुक्काम'),
		t('Hotels', 'होटल', 'हॉटेल'),
		t('Fuel', 'पेट्रोल', 'पेट्रोल'),
		t('ATM', 'एटीएम', 'एटीएम'),
		t('Hospital', 'अस्पताल', 'दवाखाना')
	],
	layersLabel: t('Map layers', 'नक्शे की परतें', 'नकाशाचे थर'),
	open: t('Open the map', 'नक्शा खोलें', 'नकाशा उघडा'),
	pack: t('Get offline pack', 'ऑफ़लाइन पैक लें', 'ऑफलाइन पॅक घ्या'),
	search: t('Search the map', 'नक्शे में खोजें', 'नकाशात शोधा'),
	offlineChip: t('Ratnagiri taluka · offline', 'रत्नागिरी तालुका · ऑफ़लाइन', 'रत्नागिरी तालुका · ऑफलाइन'),
	legend: {
		places: t('Places', 'जगहें', 'ठिकाणं'),
		stays: t('Stays', 'ठहराव', 'मुक्काम'),
		hotels: t('Hotels', 'होटल', 'हॉटेल'),
		trip: t('Your trip', 'आपकी यात्रा', 'तुमची सहल')
	},
	mapAria: t(
		'Map of the Ratnagiri coast with places, stays and hotels pinned',
		'रत्नागिरी तट का नक्शा, जगहें, ठहराव और होटल चिह्नित',
		'रत्नागिरी किनाऱ्याचा नकाशा, ठिकाणं, मुक्काम आणि हॉटेल दाखवलेले'
	),
	toggle: t('Turn off network', 'नेटवर्क बंद करें', 'नेटवर्क बंद करा'),
	toggleOn: t('Turn network back on', 'नेटवर्क फिर चालू करें', 'नेटवर्क पुन्हा चालू करा'),
	noNetwork: t('No network', 'नेटवर्क नहीं', 'नेटवर्क नाही'),
	signal: t('Signal', 'सिग्नल', 'सिग्नल'),
	stillWorks: t(
		'Still here. The map, pins and your route are on the phone.',
		'मैं यहीं हूँ। नक्शा, पिन और आपका रास्ता फ़ोन में है।',
		'मी इथेच आहे. नकाशा, पिन आणि तुमचा मार्ग फोनमध्येच आहे.'
	),
	demoNote: t('A demo: your real network is not touched.', 'यह डेमो है: आपका असली नेटवर्क नहीं बदलता।', 'हा डेमो आहे: तुमचं खरं नेटवर्क बदलत नाही.'),
	kinds: [
		{
			key: 'hotels',
			title: t('Hotels', 'होटल', 'हॉटेल'),
			desc: t(
				'Front desks, room service and live prices compared across Agoda and MakeMyTrip.',
				'फ़्रंट डेस्क, रूम सर्विस और Agoda व MakeMyTrip पर लाइव कीमतों की तुलना।',
				'फ्रंट डेस्क, रूम सर्व्हिस आणि Agoda व MakeMyTrip वरच्या थेट किमतींची तुलना.'
			),
			href: '/stays'
		},
		{
			key: 'stays',
			title: t('Stays', 'ठहराव', 'मुक्काम'),
			desc: t(
				'Konkani homes, orchard and agro-tourism stays where you eat with the family.',
				'कोंकणी घर, बाग़ और कृषि पर्यटन ठहराव जहाँ आप परिवार के साथ खाते हैं।',
				'कोकणी घरं, बागा आणि कृषी पर्यटन मुक्काम जिथे तुम्ही कुटुंबासोबत जेवता.'
			),
			href: '/stays'
		},
		{
			key: 'places',
			title: t('Places', 'जगहें', 'ठिकाणं'),
			desc: t(
				'Beaches, sea forts, temples and waterfalls, each one verified on foot.',
				'समुद्र तट, समुद्री किले, मंदिर और झरने, हर एक पैदल जाँचा हुआ।',
				'किनारे, जलदुर्ग, मंदिरं आणि धबधबे, प्रत्येक पायी तपासलेला.'
			),
			href: '/discover'
		}
	] as const
};

export const CRABBY = {
	eyebrow: t('Meet Crabby', 'क्रैबी से मिलिए', 'क्रॅबीला भेटा'),
	title: t('Say hello to your Konkan local', 'अपने कोंकण के स्थानीय दोस्त से मिलिए', 'तुमच्या कोकणातल्या स्थानिक मित्राला नमस्कार करा'),
	body: t(
		'Crabby is the AI guide on every page of Crabwalk. Ask about a beach, a bus, a thali or a tide, in the language you think in.',
		'क्रैबी, क्रैबवॉक के हर पेज पर मौजूद AI गाइड है। किसी समुद्र तट, बस, थाली या ज्वार के बारे में उसी भाषा में पूछें जिसमें आप सोचते हैं।',
		'क्रॅबी हा क्रॅबवॉकच्या प्रत्येक पानावरचा AI मार्गदर्शक आहे. किनारा, बस, थाळी किंवा भरतीबद्दल तुम्ही ज्या भाषेत विचार करता त्याच भाषेत विचारा.'
	),
	hello: 'नमस्कार',
	im: t("I'm Crabby.", 'मैं क्रैबी हूँ।', 'मी क्रॅबी.'),
	questions: [
		{ text: 'Best time to visit Jaigad Fort?', lang: 'en' },
		{ text: 'रत्नागिरीत शाकाहारी थाळी कुठे मिळेल?', lang: 'mr' },
		{ text: 'गणपतीपुळे में आज भीड़ कैसी है?', lang: 'hi' },
		{ text: '"2 days, kids, low budget"', lang: 'en', voice: true }
	],
	voice: t('Spoken question', 'बोलकर पूछा सवाल', 'बोलून विचारलेला प्रश्न'),
	points: [
		{
			icon: 'language',
			title: t('Speaks your language', 'आपकी भाषा बोलता है', 'तुमची भाषा बोलतो'),
			desc: t(
				'English, हिंदी or मराठी. Type it or just say it out loud.',
				'English, हिंदी या मराठी। लिखें या बस बोल दें।',
				'English, हिंदी किंवा मराठी. टाइप करा किंवा फक्त बोला.'
			)
		},
		{
			icon: 'spark',
			title: t('Does, not just answers', 'सिर्फ़ जवाब नहीं, काम भी', 'फक्त उत्तर नाही, कामही'),
			desc: t(
				'Builds your plan, opens the map, shortlists stays. You confirm every change.',
				'आपका प्लान बनाता है, नक्शा खोलता है, ठहराव चुनता है। हर बदलाव आप मंज़ूर करते हैं।',
				'तुमचा प्लॅन बनवतो, नकाशा उघडतो, मुक्काम निवडतो. प्रत्येक बदल तुम्ही मंजूर करता.'
			)
		},
		{
			icon: 'shield',
			title: t('Honest by design', 'बनावट से ईमानदार', 'मुळातच प्रामाणिक'),
			desc: t(
				'Answers only from places our team has verified. If it does not know, it says so.',
				'सिर्फ़ उन्हीं जगहों से जवाब देता है जिन्हें हमारी टीम ने जाँचा है। न पता हो तो साफ़ कहता है।',
				'फक्त आमच्या टीमने तपासलेल्या ठिकाणांवरूनच उत्तर देतो. माहीत नसेल तर तसं सांगतो.'
			)
		},
		{
			icon: 'phone',
			title: t('Safety comes first', 'सुरक्षा पहले', 'सुरक्षा आधी'),
			desc: t(
				'Say "accident" or "snake bite" and it skips the chat to show 112 and the nearest hospital.',
				'"दुर्घटना" या "साँप ने काटा" कहें, तो यह बातचीत छोड़कर सीधे 112 और नज़दीकी अस्पताल दिखाता है।',
				'"अपघात" किंवा "साप चावला" म्हणा, तो गप्पा सोडून थेट 112 आणि जवळचा दवाखाना दाखवतो.'
			)
		}
	],
	chat: t('Chat with Crabby', 'क्रैबी से बात करें', 'क्रॅबीशी बोला'),
	how: t('See how it plans a trip', 'देखें यह यात्रा कैसे प्लान करता है', 'तो सहल कशी आखतो ते पाहा'),
	stageLabel: t('Crabby, the Crabwalk fiddler crab, waving', 'क्रैबी, क्रैबवॉक का फ़िडलर केकड़ा, हाथ हिलाते हुए', 'क्रॅबी, क्रॅबवॉकचा फिडलर खेकडा, हात हलवताना')
};

export const PLANNER = {
	eyebrow: t('Trip planner', 'ट्रिप प्लानर', 'सहल नियोजक'),
	title: t('Tell it your trip. Get a plan with reasons.', 'अपनी यात्रा बताइए। वजहों के साथ प्लान पाइए।', 'तुमची सहल सांगा. कारणांसह प्लॅन मिळवा.'),
	body: t(
		"Real Konkan road times, opening hours, tides and weather go in. A day-by-day plan comes out, and every stop says why it is there. If Crabby doesn't know, it says so.",
		'असली कोंकण सड़क समय, खुलने के घंटे, ज्वार और मौसम अंदर जाते हैं। दिन-ब-दिन प्लान बाहर आता है, और हर पड़ाव बताता है कि वह क्यों है। क्रैबी को न पता हो तो वह साफ़ कहता है।',
		'कोकणातले खरे रस्ते-वेळ, उघडण्याच्या वेळा, भरती-ओहोटी आणि हवामान आत जातं. दिवसवार प्लॅन बाहेर येतो, आणि प्रत्येक थांबा का आहे ते सांगतो. क्रॅबीला माहीत नसेल तर तो तसं सांगतो.'
	),
	plan: t('Plan my trip', 'मेरी यात्रा प्लान करें', 'माझी सहल आखा'),
	ready: t('See ready-made routes', 'तैयार रास्ते देखें', 'तयार मार्ग पाहा'),
	routes: [
		t('Ratnagiri in 2 days', '2 दिनों में रत्नागिरी', '2 दिवसांत रत्नागिरी'),
		t('Temples of Konkan', 'कोंकण के मंदिर', 'कोकणातली मंदिरं'),
		t('Hidden beaches', 'छिपे समुद्र तट', 'लपलेले किनारे'),
		t('Forts trail', 'किलों की राह', 'किल्ल्यांची वाट'),
		t('Family weekend', 'परिवार का वीकेंड', 'कुटुंबाचा वीकेंड')
	],
	ask: t('3 days, family with kids, veg, low budget', '3 दिन, बच्चों के साथ परिवार, शाकाहारी, कम बजट', '3 दिवस, मुलांसह कुटुंब, शाकाहारी, कमी बजेट'),
	days: t('Days', 'दिन', 'दिवस'),
	thinking: t('Crabby is checking road times and tides', 'क्रैबी सड़क समय और ज्वार देख रहा है', 'क्रॅबी रस्ते-वेळ आणि भरती पाहतोय'),
	estimate: t('Estimated for 4 people', '4 लोगों के लिए अनुमान', '4 जणांसाठी अंदाज'),
	total: '₹[total]',
	apply: t('Apply plan', 'प्लान लागू करें', 'प्लॅन लागू करा'),
	discard: t('Discard', 'हटाएँ', 'रद्द करा'),
	replay: t('Replay', 'फिर से चलाएँ', 'पुन्हा चालवा'),
	demo: t('Demo plan · sample stops', 'डेमो प्लान · नमूना पड़ाव', 'डेमो प्लॅन · नमुना थांबे'),
	mapLabel: t('Route of the day on a small map', 'छोटे नक्शे पर दिन का रास्ता', 'छोट्या नकाशावर दिवसाचा मार्ग')
};

/** D1 is the reference's plan; D2/D3 reuse reference places with plain reasons (PLAN.md §5.3, demo copy).
 *  x/y = position on the mini map (0–100). */
export const DAYS = [
	{
		title: t('Day 1 · Ratnagiri town', 'दिन 1 · रत्नागिरी शहर', 'दिवस 1 · रत्नागिरी शहर'),
		stops: [
			{ time: '08:30', name: t('Ratnadurg Fort', 'रत्नदुर्ग किला', 'रत्नदुर्ग किल्ला'), why: t('Cool morning climb, clear sea view', 'सुबह की ठंडी चढ़ाई, साफ़ समुद्री नज़ारा', 'सकाळची थंड चढण, स्वच्छ समुद्रदृश्य'), x: 22, y: 30 },
			{ time: '11:00', name: t('Thibaw Palace', 'थीबा पैलेस', 'थिबा राजवाडा'), why: t('Indoors through the midday heat', 'दोपहर की गर्मी में अंदर', 'दुपारच्या उन्हात आत'), x: 48, y: 44 },
			{ time: '13:00', name: t('Home-style veg thali', 'घर जैसी शाकाहारी थाली', 'घरगुती शाकाहारी थाळी'), why: t('Veg, kid-friendly, within budget', 'शाकाहारी, बच्चों के लिए ठीक, बजट में', 'शाकाहारी, मुलांना योग्य, बजेटमध्ये'), x: 62, y: 62 },
			{ time: '16:00', name: t('Ganpatipule', 'गणपतिपुळे', 'गणपतीपुळे'), why: t('Low crowd + sunset', 'कम भीड़ + सूर्यास्त', 'कमी गर्दी + सूर्यास्त'), x: 30, y: 82 }
		]
	},
	{
		title: t('Day 2 · North coast', 'दिन 2 · उत्तरी तट', 'दिवस 2 · उत्तर किनारा'),
		stops: [
			{ time: '08:00', name: t('Jaigad Fort', 'जयगढ़ किला', 'जयगड किल्ला'), why: t('Walls in the shade before ten', 'दस बजे से पहले छाँव में दीवारें', 'दहाच्या आधी सावलीत तटबंदी'), x: 26, y: 20 },
			{ time: '10:30', name: t('Jaigad lighthouse', 'जयगढ़ लाइटहाउस', 'जयगड दीपगृह'), why: t('Short walk, kids love the view', 'छोटी सैर, बच्चों को नज़ारा पसंद', 'छोटी चाल, मुलांना दृश्य आवडतं'), x: 16, y: 34 },
			{ time: '13:00', name: t('Village lunch at Ganpatipule', 'गणपतिपुळे में गाँव का खाना', 'गणपतीपुळ्यात गावरान जेवण'), why: t('Veg, sits on your way back', 'शाकाहारी, लौटते रास्ते पर', 'शाकाहारी, परतीच्या वाटेवर'), x: 40, y: 58 },
			{ time: '16:30', name: t('Aare Ware viewpoint', 'आरे वारे व्यू पॉइंट', 'आरे वारे व्ह्यू पॉइंट'), why: t('Two beaches in one frame', 'एक फ़्रेम में दो तट', 'एका फ्रेममध्ये दोन किनारे'), x: 56, y: 78 }
		]
	},
	{
		title: t('Day 3 · South to Pawas', 'दिन 3 · दक्षिण में पावस', 'दिवस 3 · दक्षिणेला पावस'),
		stops: [
			{ time: '08:30', name: t('Bhatye beach', 'भाट्ये तट', 'भाट्ये किनारा'), why: t('Calm water, good for a paddle', 'शांत पानी, पैर भिगोने लायक', 'शांत पाणी, पाय भिजवायला छान'), x: 30, y: 24 },
			{ time: '10:30', name: t('Pawas', 'पावस', 'पावस'), why: t('Quiet village, shaded lanes', 'शांत गाँव, छायादार गलियाँ', 'शांत गाव, सावलीच्या वाटा'), x: 52, y: 46 },
			{ time: '13:00', name: t('Konkani thali', 'कोंकणी थाली', 'कोकणी थाळी'), why: t('Veg plates, low budget', 'शाकाहारी थाली, कम बजट', 'शाकाहारी थाळी, कमी बजेट'), x: 64, y: 64 },
			{ time: '15:30', name: t('Drive home', 'घर वापसी', 'घरी परत'), why: t('Leaves time before dark', 'अंधेरे से पहले समय बचता है', 'अंधार पडण्याआधी वेळ उरतो'), x: 78, y: 84 }
		]
	}
];

export const VERDICT = {
	eyebrow: t('The verdict', 'फ़ैसला', 'निकाल'),
	title1: t('Rated by travellers,', 'यात्रियों ने आँका,', 'प्रवाशांनी ठरवलं,'),
	title2: t('in one honest word', 'एक ईमानदार शब्द में', 'एका प्रामाणिक शब्दात'),
	body: t(
		'No stars to decode. Every place, stay and kitchen gets a verdict, split by family, couple, solo and friends. Hygiene scores come only from people who were really there.',
		'समझने के लिए कोई सितारे नहीं। हर जगह, ठहराव और रसोई को एक फ़ैसला मिलता है, परिवार, जोड़े, अकेले और दोस्तों में बँटा हुआ। साफ़-सफ़ाई के अंक सिर्फ़ उन्हीं से आते हैं जो सच में वहाँ गए।',
		'उलगडायला तारे नाहीत. प्रत्येक ठिकाण, मुक्काम आणि स्वयंपाकघराला एक निकाल मिळतो, कुटुंब, जोडपं, एकटे आणि मित्र असा विभागलेला. स्वच्छतेचे गुण फक्त खरंच तिथे गेलेल्यांकडूनच येतात.'
	),
	place: t('Ratnadurg Fort', 'रत्नदुर्ग किला', 'रत्नदुर्ग किल्ला'),
	placeMeta: t('Fort · Ratnagiri', 'किला · रत्नागिरी', 'किल्ला · रत्नागिरी'),
	who: t('Who is travelling', 'कौन यात्रा कर रहा है', 'कोण प्रवास करतंय'),
	of: t('[%] of [n] {group} votes', '[n] {group} वोटों में [%]', '[n] {group} मतांपैकी [%]'),
	read: t('Read traveller verdicts', 'यात्रियों के फ़ैसले पढ़ें', 'प्रवाशांचे निकाल वाचा'),
	featured: t('Velneshwar · family trip', 'वेलणेश्वर · परिवार की यात्रा', 'वेळणेश्वर · कुटुंबाची सहल'),
	wall: t('Illustrated travellers and their one-word verdicts', 'चित्रित यात्री और उनके एक-शब्द फ़ैसले', 'रेखाटलेले प्रवासी आणि त्यांचे एका शब्दातले निकाल'),
	pause: t('Pause the wall', 'दीवार रोकें', 'भिंत थांबवा'),
	play: t('Play the wall', 'दीवार चलाएँ', 'भिंत चालू करा'),
	groups: [
		{ key: 'family', label: t('Family', 'परिवार', 'कुटुंब') },
		{ key: 'couple', label: t('Couple', 'जोड़ा', 'जोडपं') },
		{ key: 'solo', label: t('Solo', 'अकेले', 'एकटे') },
		{ key: 'friends', label: t('Friends', 'दोस्त', 'मित्र') }
	] as const,
	/** Illustrative split per group (reference `dists`): bar widths only, labels stay [%] / [n]. */
	dists: {
		family: [54, 28, 12, 6],
		couple: [61, 24, 10, 5],
		solo: [47, 33, 14, 6],
		friends: [58, 26, 11, 5]
	} as Record<string, [number, number, number, number]>,
	chips: [
		t('Worth it', 'जाने लायक', 'जाण्यासारखं'),
		t('Local legend', 'लोकल लेजेंड', 'स्थानिक दंतकथा'),
		t('Must visit', 'ज़रूर जाएँ', 'नक्की जा'),
		t('Perfect stay', 'बढ़िया ठहराव', 'उत्तम मुक्काम'),
		t('Go for it', 'ज़रूर जाइए', 'नक्की जा')
	]
};

export const CLOSING = {
	title: t('Start your Konkan trip', 'अपनी कोंकण यात्रा शुरू करें', 'तुमची कोकण सहल सुरू करा'),
	body: t(
		'Install Crabwalk on your phone. It works offline, in three languages, from the first beach to the last thali.',
		'अपने फ़ोन पर क्रैबवॉक इंस्टॉल करें। यह ऑफ़लाइन, तीन भाषाओं में चलता है, पहले तट से आख़िरी थाली तक।',
		'तुमच्या फोनवर क्रॅबवॉक इन्स्टॉल करा. तो ऑफलाइन, तीन भाषांत चालतो, पहिल्या किनाऱ्यापासून शेवटच्या थाळीपर्यंत.'
	),
	plan: t('Plan with Crabby', 'क्रैबी के साथ प्लान करें', 'क्रॅबीसोबत आखा'),
	install: t('Install the app', 'ऐप इंस्टॉल करें', 'ॲप इन्स्टॉल करा'),
	installHow: t(
		'Use your browser menu: Add to Home screen.',
		'ब्राउज़र मेनू में: होम स्क्रीन पर जोड़ें।',
		'ब्राउझर मेनूमध्ये: होम स्क्रीनवर जोडा.'
	),
	watermark: 'कोकण',
	tagline: t('Ratnagiri, verified on foot. Made in the Konkan.', 'रत्नागिरी, पैदल जाँचा हुआ। कोंकण में बना।', 'रत्नागिरी, पायी तपासलेलं. कोकणात बनवलेलं.'),
	footer: t('Footer', 'फ़ुटर', 'तळटीप'),
	cols: [
		{
			title: t('Explore', 'खोजें', 'शोधा'),
			links: [
				{ label: t('Places', 'जगहें', 'ठिकाणं'), href: '/discover' },
				{ label: t('Stays', 'ठहराव', 'मुक्काम'), href: '/stays' },
				{ label: t('Taste Konkan', 'कोंकण का स्वाद', 'कोकणची चव'), href: '/taste-konkan' },
				{ label: t('Map', 'नक्शा', 'नकाशा'), href: '/map' }
			]
		},
		{
			title: t('Plan', 'प्लान', 'प्लॅन'),
			links: [
				{ label: t('Ask Crabby', 'क्रैबी से पूछें', 'क्रॅबीला विचारा'), href: '/crabby' },
				{ label: t('Ready-made routes', 'तैयार रास्ते', 'तयार मार्ग'), href: '/itineraries' },
				{ label: t('Group trips', 'समूह यात्राएँ', 'गट सहली'), href: '/plan/new' }
			]
		},
		{
			title: t('For hosts', 'मेज़बानों के लिए', 'यजमानांसाठी'),
			links: [
				{ label: t('Claim your listing', 'अपनी लिस्टिंग का दावा करें', 'तुमची नोंद मिळवा'), href: '/owner' },
				{ label: t('Sponsor a plaque', 'एक पट्टिका प्रायोजित करें', 'एक फलक प्रायोजित करा'), href: '/owner' },
				{ label: t('Report a problem', 'समस्या बताएँ', 'समस्या कळवा'), href: '/discover' }
			]
		}
	],
	copyright: t(
		'© 2026 Crabwalk · Map data © OpenStreetMap contributors',
		'© 2026 क्रैबवॉक · नक्शा डेटा © OpenStreetMap योगदानकर्ता',
		'© 2026 क्रॅबवॉक · नकाशा डेटा © OpenStreetMap योगदानकर्ते'
	),
	privacy: t('Privacy', 'गोपनीयता', 'गोपनीयता'),
	terms: t('Terms', 'शर्तें', 'अटी')
};
