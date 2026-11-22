import type { L } from '../i18n.ts';

// Onboarding copy and options (reference ob1–ob5). Login is email + code, not phone (DECISIONS G4, owner
// 2026-11-22). HI/MR are drafts for native review.
const t = (en: string, hi: string, mr: string): L => ({ en, hi, mr });

export const OB = {
	title: t('Set up your trip', 'अपनी यात्रा सेट करें', 'तुमची सहल तयार करा'),
	back: t('Back', 'पीछे', 'मागे'),
	skip: t('Skip', 'छोड़ें', 'वगळा'),
	cont: t('Continue', 'आगे बढ़ें', 'पुढे चला'),
	stepOf: t('Step {n} of 4', 'चरण {n} / 4', 'पायरी {n} / 4'),
	language: t('Language', 'भाषा', 'भाषा'),
	login: {
		hello: 'नमस्कार',
		im: t("I'm Crabby.", 'मैं क्रैबी हूँ।', 'मी क्रॅबी.'),
		title: t(
			'Your Konkan trip starts here',
			'आपकी कोंकण यात्रा यहाँ से शुरू',
			'तुमची कोकण सहल इथून सुरू'
		),
		sub: t(
			'Log in or sign up to save places, plan trips and chat with Crabby.',
			'जगहें सहेजने, यात्रा प्लान करने और क्रैबी से बात करने के लिए लॉग इन या साइन अप करें।',
			'ठिकाणं जतन करायला, सहल आखायला आणि क्रॅबीशी बोलायला लॉग इन किंवा साइन अप करा.'
		),
		email: t('Email', 'ईमेल', 'ईमेल'),
		emailHint: t(
			'We send a 6-digit code. No password.',
			'हम 6 अंकों का कोड भेजेंगे। पासवर्ड नहीं।',
			'आम्ही 6 अंकी कोड पाठवू. पासवर्ड नाही.'
		),
		send: t('Send code', 'कोड भेजें', 'कोड पाठवा'),
		sending: t('Sending', 'भेज रहे हैं', 'पाठवत आहोत'),
		or: t('or', 'या', 'किंवा'),
		google: t('Continue with Google', 'Google से जारी रखें', 'Google ने पुढे चला'),
		guest: t(
			'Just looking? Explore without an account',
			'बस देख रहे हैं? बिना खाते के घूमें',
			'फक्त पाहताय? खात्याशिवाय फिरा'
		),
		agree: t('By continuing you agree to our', 'आगे बढ़कर आप हमारी', 'पुढे जाऊन तुम्ही आमच्या'),
		terms: t('Terms', 'शर्तें', 'अटी'),
		and: t('and', 'और', 'आणि'),
		privacy: t('Privacy Policy', 'गोपनीयता नीति', 'गोपनीयता धोरण'),
		agreeEnd: t('.', ' से सहमत होते हैं।', ' मान्य करता.'),
		gate: t(
			'Sign-in opens at launch. For now, explore without an account: your choices stay on this phone.',
			'साइन-इन लॉन्च पर खुलेगा। अभी बिना खाते के घूमें: आपकी पसंद इसी फ़ोन पर रहेगी।',
			'साइन-इन लाँचला सुरू होईल. सध्या खात्याशिवाय फिरा: तुमच्या निवडी याच फोनवर राहतील.'
		),
		errEmail: t('Enter a valid email address.', 'सही ईमेल पता लिखें।', 'योग्य ईमेल पत्ता लिहा.'),
		errSend: t(
			"We couldn't send the code. Try again in a minute.",
			'कोड नहीं भेज पाए। एक मिनट बाद फिर कोशिश करें।',
			'कोड पाठवता आला नाही. एका मिनिटाने पुन्हा प्रयत्न करा.'
		),
		errRate: t(
			'Too many tries. Wait a minute, then try again.',
			'बहुत कोशिशें। एक मिनट रुककर फिर कोशिश करें।',
			'खूप प्रयत्न झाले. एक मिनिट थांबा आणि पुन्हा करा.'
		),
		offline: t(
			"You're offline. Connect to get a code.",
			'आप ऑफ़लाइन हैं। कोड पाने के लिए कनेक्ट करें।',
			'तुम्ही ऑफलाइन आहात. कोड मिळवायला कनेक्ट करा.'
		)
	},
	code: {
		title: t('Enter the code', 'कोड डालें', 'कोड टाका'),
		sub: t(
			'We sent a 6-digit code to {email}.',
			'हमने {email} पर 6 अंकों का कोड भेजा है।',
			'आम्ही {email} वर 6 अंकी कोड पाठवला आहे.'
		),
		label: t('6-digit code', '6 अंकों का कोड', '6 अंकी कोड'),
		digit: t('Digit {n} of 6', 'अंक {n} / 6', 'अंक {n} / 6'),
		verify: t('Verify', 'पुष्टि करें', 'खात्री करा'),
		resendIn: t('Resend code in {s} s', '{s} सेकंड में फिर भेजें', '{s} सेकंदांत पुन्हा पाठवा'),
		resend: t('Resend code', 'कोड फिर भेजें', 'कोड पुन्हा पाठवा'),
		sent: t('A new code is on its way.', 'नया कोड भेज दिया है।', 'नवा कोड पाठवला आहे.'),
		change: t('Use a different email', 'दूसरा ईमेल इस्तेमाल करें', 'दुसरा ईमेल वापरा'),
		error: t(
			"That code didn't work. Check it, or ask for a new one.",
			'यह कोड नहीं चला। जाँचें, या नया माँगें।',
			'हा कोड चालला नाही. तपासा, किंवा नवा मागवा.'
		)
	},
	about: {
		crabby: t(
			'Step 1 of 4 · takes a minute',
			'चरण 1 / 4 · एक मिनट लगेगा',
			'पायरी 1 / 4 · एक मिनिट लागेल'
		),
		title: t(
			'First, what should Crabby call you?',
			'पहले, क्रैबी आपको क्या बुलाए?',
			'आधी सांगा, क्रॅबीने तुम्हाला काय म्हणावं?'
		),
		name: t('Your name', 'आपका नाम', 'तुमचं नाव'),
		namePh: t('e.g. Dharma', 'जैसे धर्मा', 'उदा. धर्मा'),
		lang: t(
			'Which language feels like home?',
			'कौन सी भाषा अपनी लगती है?',
			'कोणती भाषा आपली वाटते?'
		),
		city: t(
			'Where do you usually start from?',
			'आप आम तौर पर कहाँ से निकलते हैं?',
			'तुम्ही सहसा कुठून निघता?'
		),
		optional: t('(optional)', '(वैकल्पिक)', '(ऐच्छिक)'),
		cityPh: t('Pune, Mumbai, Kolhapur…', 'पुणे, मुंबई, कोल्हापुर…', 'पुणे, मुंबई, कोल्हापूर…')
	},
	langs: [
		{ key: 'en', name: 'English', sample: 'Hi! Where shall we go today?' },
		{ key: 'hi', name: 'हिंदी', sample: 'नमस्ते! आज कहाँ चलें?' },
		{ key: 'mr', name: 'मराठी', sample: 'नमस्कार! आज कुठे जायचं?' }
	] as const,
	group: {
		crabby: t(
			'So I can split verdicts for people like you',
			'ताकि मैं आप जैसे लोगों के फ़ैसले अलग दिखा सकूँ',
			'म्हणजे तुमच्यासारख्यांचे निकाल वेगळे दाखवता येतील'
		),
		title: t(
			'Who usually travels with you?',
			'आम तौर पर आपके साथ कौन जाता है?',
			'तुमच्यासोबत सहसा कोण येतं?'
		),
		label: t('Group type', 'समूह का प्रकार', 'गटाचा प्रकार'),
		care: t(
			'Anyone who needs a little extra care?',
			'किसी को थोड़ी ज़्यादा देखभाल चाहिए?',
			'कुणाला थोडी जास्त काळजी लागते का?'
		),
		modes: t('How do you get around?', 'आप कैसे घूमते हैं?', 'तुम्ही कसे फिरता?')
	},
	groups: [
		{
			key: 'solo',
			icon: 'solo',
			label: t('Solo', 'अकेले', 'एकटे'),
			hint: t('Just me', 'सिर्फ़ मैं', 'फक्त मी')
		},
		{
			key: 'couple',
			icon: 'couple',
			label: t('Couple', 'जोड़ा', 'जोडपं'),
			hint: t('The two of us', 'हम दोनों', 'आम्ही दोघं')
		},
		{
			key: 'family',
			icon: 'family',
			label: t('Family', 'परिवार', 'कुटुंब'),
			hint: t('Parents, kids, elders', 'माता-पिता, बच्चे, बुज़ुर्ग', 'आई-बाबा, मुलं, वडीलधारे')
		},
		{
			key: 'friends',
			icon: 'friends',
			label: t('Friends', 'दोस्त', 'मित्र'),
			hint: t('A gang of 3+', '3+ की टोली', '3+ जणांचा ग्रुप')
		}
	] as const,
	care: [
		{ key: 'kids', label: t('Kids under 10', '10 से छोटे बच्चे', '10 वर्षांखालची मुलं') },
		{ key: 'elders', label: t('Elders', 'बुज़ुर्ग', 'वडीलधारे') },
		{ key: 'pets', label: t('Pets', 'पालतू जानवर', 'पाळीव प्राणी') },
		{ key: 'access', label: t('Wheelchair user', 'व्हीलचेयर उपयोगकर्ता', 'व्हीलचेअर वापरणारे') }
	] as const,
	modes: [
		{ key: 'car', label: t('Own car', 'अपनी कार', 'स्वतःची गाडी') },
		{ key: 'bike', label: t('Bike', 'बाइक', 'बाइक') },
		{ key: 'bus', label: t('ST bus / train', 'एसटी बस / ट्रेन', 'एसटी बस / ट्रेन') },
		{ key: 'cab', label: t('Hired cab', 'किराए की टैक्सी', 'भाड्याची गाडी') }
	] as const,
	interests: {
		crabby: t(
			"Pick at least 3. I'll plan around them.",
			'कम से कम 3 चुनें। मैं इन्हीं के हिसाब से प्लान करूँगा।',
			'किमान 3 निवडा. मी त्याप्रमाणे आखणी करेन.'
		),
		title: t(
			'What pulls you to the coast?',
			'तट की ओर आपको क्या खींचता है?',
			'तुम्हाला किनाऱ्याकडे काय ओढतं?'
		),
		picked: t('{n} picked', '{n} चुने', '{n} निवडले'),
		label: t('Interests', 'रुचियाँ', 'आवडी'),
		pace: t('Your travel pace', 'आपकी यात्रा की रफ़्तार', 'तुमचा प्रवासाचा वेग'),
		gems: t('Prefer hidden gems', 'छिपे रत्न पसंद', 'लपलेली रत्नं आवडतात'),
		gemsHint: t(
			'Calmer spots over the famous crowds',
			'मशहूर भीड़ के बजाय शांत जगहें',
			'प्रसिद्ध गर्दीऐवजी शांत ठिकाणं'
		),
		need: t(
			'Pick {n} more to continue',
			'आगे बढ़ने के लिए {n} और चुनें',
			'पुढे जायला अजून {n} निवडा'
		)
	},
	interestList: [
		{ key: 'beach', icon: 'beach', label: t('Beaches', 'समुद्र तट', 'किनारे') },
		{ key: 'fort', icon: 'fort', label: t('Sea forts', 'समुद्री किले', 'जलदुर्ग') },
		{ key: 'temple', icon: 'temple', label: t('Temples', 'मंदिर', 'मंदिरं') },
		{ key: 'falls', icon: 'waterfall', label: t('Waterfalls', 'झरने', 'धबधबे') },
		{ key: 'view', icon: 'viewpoint', label: t('Viewpoints', 'व्यू पॉइंट', 'व्ह्यू पॉइंट') },
		{ key: 'backwater', icon: 'backwater', label: t('Backwaters', 'बैकवॉटर', 'खाड्या') },
		{ key: 'cave', icon: 'cave', label: t('Caves', 'गुफाएँ', 'गुहा') },
		{ key: 'museum', icon: 'museum', label: t('Museums', 'संग्रहालय', 'संग्रहालयं') },
		{ key: 'village', icon: 'village', label: t('Villages', 'गाँव', 'गावं') },
		{ key: 'market', icon: 'market', label: t('Markets', 'बाज़ार', 'बाजार') },
		{ key: 'orchard', icon: 'orchard', label: t('Orchards', 'बाग़', 'बागा') },
		{ key: 'food', icon: 'thali', label: t('Local food', 'स्थानीय खाना', 'स्थानिक जेवण') },
		{ key: 'gems', icon: 'gem', label: t('Hidden gems', 'छिपे रत्न', 'लपलेली रत्नं') },
		{ key: 'trek', icon: 'trek', label: t('Treks', 'ट्रेक', 'ट्रेक') }
	] as const,
	paces: [
		{
			key: 'relaxed',
			label: t('Relaxed', 'आराम से', 'निवांत'),
			hint: t('2–3 stops a day', 'दिन में 2–3 पड़ाव', 'दिवसाला 2–3 थांबे')
		},
		{
			key: 'balanced',
			label: t('Balanced', 'संतुलित', 'संतुलित'),
			hint: t('4–5 stops', '4–5 पड़ाव', '4–5 थांबे')
		},
		{
			key: 'packed',
			label: t('Packed', 'भरपूर', 'भरगच्च'),
			hint: t('See it all', 'सब कुछ देखें', 'सगळं पाहा')
		}
	] as const,
	food: {
		crabby: t(
			'Last one. Then your coast is ready.',
			'आख़िरी सवाल। फिर आपका तट तैयार।',
			'शेवटचा प्रश्न. मग तुमचा किनारा तयार.'
		),
		title: t(
			'How do you eat and stay?',
			'आप कैसे खाते और ठहरते हैं?',
			'तुम्ही कसं जेवता आणि राहता?'
		),
		food: t('Food', 'खाना', 'जेवण'),
		budget: t(
			'Budget per person, per day',
			'प्रति व्यक्ति, प्रति दिन बजट',
			'प्रति व्यक्ती, प्रति दिवस बजेट'
		),
		budgetHint: t('(stay + food + travel)', '(ठहराव + खाना + यात्रा)', '(मुक्काम + जेवण + प्रवास)'),
		stay: t('Kind of stay', 'ठहरने का प्रकार', 'मुक्कामाचा प्रकार'),
		privacy: t(
			'Crabby remembers only these preferences, never your chats. Change them any time in Me.',
			'क्रैबी सिर्फ़ ये पसंद याद रखता है, आपकी बातचीत कभी नहीं। इन्हें कभी भी "मैं" में बदलें।',
			'क्रॅबी फक्त या आवडी लक्षात ठेवतो, तुमच्या गप्पा कधीच नाही. त्या कधीही "मी" मध्ये बदला.'
		),
		start: t('Start exploring', 'घूमना शुरू करें', 'फिरायला सुरुवात करा')
	},
	foods: [
		{ key: 'veg', label: t('Veg', 'शाकाहारी', 'शाकाहारी'), dot: '#2e7d32', shape: 'circle' },
		{
			key: 'nonveg',
			label: t('Non-veg', 'मांसाहारी', 'मांसाहारी'),
			dot: '#a1371f',
			shape: 'triangle'
		},
		{ key: 'jain', label: t('Jain', 'जैन', 'जैन'), dot: '#2e7d32', shape: 'circle' },
		{
			key: 'egg',
			label: t('Eggetarian', 'अंडा खाने वाले', 'अंडं चालणारे'),
			dot: '#b7791f',
			shape: 'circle'
		}
	] as const,
	budgets: [
		{ key: 'low', label: t('Under ₹1,500', '₹1,500 से कम', '₹1,500 पेक्षा कमी') },
		{ key: 'mid', label: same('₹1,500–3,000') },
		{ key: 'high', label: same('₹3,000–6,000') },
		{ key: 'lux', label: same('₹6,000+') }
	] as const,
	stays: [
		{
			key: 'homely',
			icon: 'stay',
			label: t('Homely', 'घरेलू', 'घरगुती'),
			hint: t('Eat with the family', 'परिवार के साथ खाना', 'कुटुंबासोबत जेवण')
		},
		{
			key: 'pro',
			icon: 'hotel',
			label: t('Professional', 'प्रोफ़ेशनल', 'व्यावसायिक'),
			hint: t('Front desk, room service', 'फ़्रंट डेस्क, रूम सर्विस', 'फ्रंट डेस्क, रूम सर्व्हिस')
		}
	] as const,
	done: {
		ready: t(
			'Your Konkan is ready, {name}',
			'आपका कोंकण तैयार है, {name}',
			'तुमचं कोकण तयार आहे, {name}'
		),
		friend: t('friend', 'दोस्त', 'मित्रा'),
		sub: t(
			'Crabby will plan around what you picked. Change anything later in Me.',
			'क्रैबी आपकी पसंद के हिसाब से प्लान करेगा। बाद में "मैं" में कुछ भी बदलें।',
			'क्रॅबी तुमच्या निवडींनुसार आखणी करेल. नंतर "मी" मध्ये काहीही बदला.'
		),
		go: t('Open my Konkan', 'मेरा कोंकण खोलें', 'माझं कोकण उघडा'),
		home: t('Back to the landing page', 'लैंडिंग पेज पर लौटें', 'मुख्य पानावर परत'),
		postcard: t('Your trip postcard', 'आपकी यात्रा का पोस्टकार्ड', 'तुमच्या सहलीचं पोस्टकार्ड'),
		to: t('To', 'प्रति', 'प्रति'),
		from: t('From the Konkan coast', 'कोंकण तट से', 'कोकण किनाऱ्याकडून'),
		perDay: t('per day', 'प्रति दिन', 'दर दिवशी'),
		greetings: t('Greetings from Ratnagiri', 'रत्नागिरी से नमस्ते', 'रत्नागिरीहून नमस्कार')
	}
};

function same(s: string): L {
	return { en: s, hi: s, mr: s };
}

export type ObState = {
	step: 'login' | 'code' | 'about' | 'group' | 'interests' | 'food' | 'done';
	email: string;
	name: string;
	lang: 'en' | 'hi' | 'mr';
	city: string;
	group: '' | 'solo' | 'couple' | 'family' | 'friends';
	care: string[];
	modes: string[];
	interests: string[];
	pace: 'relaxed' | 'balanced' | 'packed';
	gems: boolean;
	food: '' | 'veg' | 'nonveg' | 'jain' | 'egg';
	budget: '' | 'low' | 'mid' | 'high' | 'lux';
	stay: '' | 'homely' | 'pro';
};

export const OB_STEPS: ObState['step'][] = [
	'login',
	'code',
	'about',
	'group',
	'interests',
	'food',
	'done'
];
export const OB_KEY = 'cw_onboarding';
