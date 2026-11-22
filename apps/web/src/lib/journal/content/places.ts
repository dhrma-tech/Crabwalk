import type { L } from '../i18n.ts';
import type { TalukaKey } from './talukas.ts';

const t = (en: string, hi: string, mr: string): L => ({ en, hi, mr });

// Categories (reference `catNames`): 11 ways into the coast. `photo` = the existing category photos (static/
// categories, CREDITS.md), shown in duotone in the hover preview. `count` stays a placeholder until live data.
export type CategoryKey =
	| 'beach'
	| 'fort'
	| 'temple'
	| 'waterfall'
	| 'viewpoint'
	| 'backwater'
	| 'cave'
	| 'museum'
	| 'village'
	| 'market'
	| 'orchard';

export const CATEGORIES: { key: CategoryKey; name: L; line: L }[] = [
	{ key: 'beach', name: t('Beach', 'समुद्र तट', 'किनारा'), line: t('Sand, tides and sunsets', 'रेत, ज्वार और सूर्यास्त', 'वाळू, भरती आणि सूर्यास्त') },
	{ key: 'fort', name: t('Fort', 'किला', 'किल्ला'), line: t('Sea forts and hill forts', 'समुद्री और पहाड़ी किले', 'जलदुर्ग आणि गिरिदुर्ग') },
	{ key: 'temple', name: t('Temple', 'मंदिर', 'मंदिर'), line: t('Old coastal shrines', 'पुराने तटीय मंदिर', 'जुनी किनारी देवळं') },
	{ key: 'waterfall', name: t('Waterfall', 'झरना', 'धबधबा'), line: t('Monsoon falls, flagged for safety', 'बरसाती झरने, सुरक्षा जानकारी के साथ', 'पावसाळी धबधबे, सुरक्षेच्या खुणांसह') },
	{ key: 'viewpoint', name: t('Viewpoint', 'व्यू पॉइंट', 'व्ह्यू पॉइंट'), line: t('Cliffs above the sea', 'समुद्र के ऊपर चट्टानें', 'समुद्रावरचे कडे') },
	{ key: 'backwater', name: t('Backwater', 'बैकवॉटर', 'खाडी'), line: t('Creeks and mangroves', 'खाड़ियाँ और मैंग्रोव', 'खाड्या आणि खारफुटी') },
	{ key: 'cave', name: t('Cave', 'गुफा', 'गुहा'), line: t('Rock-cut and sea caves', 'चट्टान और समुद्री गुफाएँ', 'कोरीव आणि सागरी गुहा') },
	{ key: 'museum', name: t('Museum', 'संग्रहालय', 'संग्रहालय'), line: t('Palaces and local history', 'महल और स्थानीय इतिहास', 'राजवाडे आणि स्थानिक इतिहास') },
	{ key: 'village', name: t('Village', 'गाँव', 'गाव'), line: t('Red-earth lanes and tiled roofs', 'लाल मिट्टी की गलियाँ और खपरैल', 'लाल मातीच्या वाटा आणि कौलारू घरं') },
	{ key: 'market', name: t('Market', 'बाज़ार', 'बाजार'), line: t('Fish, kokum and cashews', 'मछली, कोकम और काजू', 'मासे, कोकम आणि काजू') },
	{ key: 'orchard', name: t('Orchard', 'बाग़', 'बाग'), line: t('Alphonso mango country', 'अल्फांसो आम का इलाका', 'हापूस आंब्याचा प्रदेश') }
];

// Hidden gems (reference `gemData`). The verdict split is the reference's illustrative sample (PLAN.md §5.2): only
// the bar widths use it, every visible count stays [n]. `scene` picks the placeholder illustration.
export type Gem = {
	key: string;
	name: L;
	cat: CategoryKey;
	taluka: TalukaKey;
	crowd: L;
	verdict: 'must' | 'worth';
	split: [number, number, number, number];
	scene: 'cove' | 'cliff' | 'falls' | 'village';
};

const calm = t('Calm · typical', 'शांत · आम तौर पर', 'शांत · सहसा');
const empty = t('Empty · typical', 'खाली · आम तौर पर', 'रिकामं · सहसा');

export const GEMS: Gem[] = [
	{ key: 'velneshwar', name: t('Velneshwar', 'वेलणेश्वर', 'वेळणेश्वर'), cat: 'beach', taluka: 'guhagar', crowd: calm, verdict: 'must', split: [46, 32, 16, 6], scene: 'cove' },
	{ key: 'bhandarpule', name: t('Bhandarpule', 'भंडारपुळे', 'भंडारपुळे'), cat: 'beach', taluka: 'ratnagiri', crowd: empty, verdict: 'worth', split: [38, 40, 16, 6], scene: 'cliff' },
	{ key: 'marleshwar', name: t('Marleshwar', 'मार्लेश्वर', 'मार्लेश्वर'), cat: 'waterfall', taluka: 'sangameshwar', crowd: calm, verdict: 'must', split: [52, 30, 12, 6], scene: 'falls' },
	{ key: 'kolthare', name: t('Kolthare', 'कोळथरे', 'कोळथरे'), cat: 'beach', taluka: 'dapoli', crowd: empty, verdict: 'worth', split: [34, 42, 18, 6], scene: 'cove' },
	{ key: 'pawas', name: t('Pawas', 'पावस', 'पावस'), cat: 'village', taluka: 'ratnagiri', crowd: calm, verdict: 'worth', split: [30, 44, 20, 6], scene: 'village' },
	{ key: 'ladghar', name: t('Ladghar', 'लाडघर', 'लाडघर'), cat: 'beach', taluka: 'dapoli', crowd: calm, verdict: 'must', split: [48, 30, 16, 6], scene: 'cliff' }
];

export const GEM_FILTERS: (TalukaKey | 'all')[] = ['all', 'ratnagiri', 'dapoli', 'guhagar', 'sangameshwar'];

export const VERDICTS = {
	must: t('Must visit', 'ज़रूर जाएँ', 'नक्की जा'),
	worth: t('Worth it', 'जाने लायक', 'जाण्यासारखं'),
	timepass: t('Timepass', 'टाइमपास', 'टाइमपास'),
	skip: t('Skip', 'छोड़ें', 'टाळा')
};
export const VERDICT_ORDER = ['must', 'worth', 'timepass', 'skip'] as const;
/** Bar colours, darkest = best. Colour is never the only signal: each bar has a legend with words. */
export const VERDICT_TONES = ['#2f4156', '#567c8d', '#a9c2d4', '#dcd3cc'];
