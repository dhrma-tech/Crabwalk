<script lang="ts">
	import Heart from '@lucide/svelte/icons/heart';
	import Share2 from '@lucide/svelte/icons/share-2';
	import Clock from '@lucide/svelte/icons/clock';
	import Ticket from '@lucide/svelte/icons/ticket';
	import Route from '@lucide/svelte/icons/route';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import IconButton from '#lib/components/IconButton.svelte';
	import Chip from '#lib/components/Chip.svelte';
	import Segmented from '#lib/components/Segmented.svelte';
	import TagList from '#lib/components/TagList.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import PlaceCard from '#lib/components/PlaceCard.svelte';
	import StayCard from '#lib/components/StayCard.svelte';
	import EateryCard from '#lib/components/EateryCard.svelte';
	import HeroCard from '#lib/components/HeroCard.svelte';
	import Carousel from '#lib/components/Carousel.svelte';
	import InsetList from '#lib/components/InsetList.svelte';
	import NoPhoto from '#lib/components/NoPhoto.svelte';
	import Input from '#lib/components/Input.svelte';
	import Skeleton from '#lib/components/Skeleton.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import ErrorState from '#lib/components/ErrorState.svelte';
	import BottomSheet from '#lib/components/BottomSheet.svelte';
	import CategoryIcon, { type Category } from '#lib/components/CategoryIcon.svelte';
	import VerdictGauge, { type Agg } from '#lib/components/rating/VerdictGauge.svelte';
	import VerdictVote from '#lib/components/rating/VerdictVote.svelte';
	import MiniVerdict from '#lib/components/rating/MiniVerdict.svelte';
	import SubScores from '#lib/components/rating/SubScores.svelte';
	import Facts from '#lib/components/listing/Facts.svelte';
	import PriceTable from '#lib/components/listing/PriceTable.svelte';
	import AudioGuide from '#lib/components/listing/AudioGuide.svelte';
	import TideSlider from '#lib/components/map/TideSlider.svelte';
	import ActionPreviewCard from '#lib/components/crabby/ActionPreviewCard.svelte';
	import { toast } from '#lib/toast.svelte.ts';

	// Every component in every state (Report 3 step D2), with deliberately long strings per locale (FRONTEND
	// §10: test with the longest Marathi string). Sample data only; this page is never in a production build.
	const s = {
		en: {
			name: 'Shree Ganpatipule Temple and Beach Promenade',
			button: 'Add to my trip plan',
			chip: 'Good for families with kids',
			tags: ['Quiet beach', 'Sunset view', 'Homely food', 'Sea-facing'],
			label: 'Accessible till 4:30 pm',
			cut: 'Next safe: 6:10 pm',
			risky: 'Slippery steps after rain',
			cat: 'Temple',
			auth: 'Authentic Malvani',
			dish: 'Kombdi vade with solkadhi',
			input: 'Your email address for the code',
			sub: '3 days · Family',
			fact: 'Sunrise to sunset, closed on full moon days',
			room: 'Sea-view double room with breakfast',
			line: 'Velneshwar beach'
		},
		hi: {
			name: 'श्री गणपतीपुळे मंदिर और समुद्र तट सैरगाह',
			button: 'मेरी यात्रा योजना में जोड़ें',
			chip: 'बच्चों वाले परिवारों के लिए अच्छा',
			tags: ['शांत समुद्र तट', 'सूर्यास्त का नज़ारा', 'घर जैसा खाना', 'समुद्र की ओर'],
			label: 'शाम 4:30 तक पहुँच योग्य',
			cut: 'अगला सुरक्षित समय: शाम 6:10',
			risky: 'बारिश के बाद फिसलन भरी सीढ़ियाँ',
			cat: 'मंदिर',
			auth: 'असली मालवणी',
			dish: 'सोलकढ़ी के साथ कोंबडी वडे',
			input: 'कोड के लिए आपका ईमेल पता',
			sub: '3 दिन · परिवार',
			fact: 'सूर्योदय से सूर्यास्त तक, पूर्णिमा को बंद',
			room: 'नाश्ते के साथ समुद्र की ओर डबल कमरा',
			line: 'वेलणेश्वर समुद्र तट'
		},
		mr: {
			name: 'श्री गणपतीपुळे देवस्थान आणि समुद्रकिनाऱ्यावरील विहारमार्ग परिसर',
			button: 'माझ्या सहलीच्या नियोजनात समाविष्ट करा',
			chip: 'लहान मुलांसोबतच्या कुटुंबांसाठी उत्तम',
			tags: ['शांत समुद्रकिनारा', 'सूर्यास्ताचे दृश्य', 'घरगुती जेवण', 'समुद्राभिमुख'],
			label: 'संध्याकाळी ४:३० पर्यंत जाता येईल',
			cut: 'पुढची सुरक्षित वेळ: संध्याकाळी ६:१०',
			risky: 'पावसानंतर निसरड्या पायऱ्या',
			cat: 'मंदिर',
			auth: 'अस्सल मालवणी',
			dish: 'सोलकढीसोबत कोंबडी वडे',
			input: 'कोडसाठी तुमचा ईमेल पत्ता',
			sub: '३ दिवस · कुटुंब',
			fact: 'सूर्योदयापासून सूर्यास्तापर्यंत, पौर्णिमेला बंद',
			room: 'न्याहारीसह समुद्राभिमुख दुहेरी खोली',
			line: 'वेळणेश्वर समुद्रकिनारा'
		}
	}[getLocale()];

	const names = { en: 'Shree Ganpatipule Temple', mr: s.name };
	const categories: Category[] = [
		'beach',
		'backwater',
		'waterfall',
		'fort',
		'temple',
		'museum',
		'cave',
		'viewpoint',
		'village',
		'market',
		'orchard'
	];
	const agg: Agg = {
		counts: [2, 3, 5, 7],
		total: 17,
		winner_level: 4,
		winner_pct: 0.41,
		is_new: false
	};
	const fresh: Agg = {
		counts: [0, 1, 2, 3],
		total: 6,
		winner_level: 4,
		winner_pct: 0.5,
		is_new: true
	};
	const tide = {
		minute: 600,
		day: {
			date: '2026-10-25',
			attribution: [{ text: 'Sample tide data (gallery)', url: '#' }],
			f: {
				properties: {
					slug: 'sample',
					max_safe: 1.2,
					extremes: [
						{ time: '2026-10-25T00:40:00+05:30', height_m: 2.1 },
						{ time: '2026-10-25T06:50:00+05:30', height_m: 0.4 },
						{ time: '2026-10-25T13:05:00+05:30', height_m: 2.3 },
						{ time: '2026-10-25T19:20:00+05:30', height_m: 0.6 }
					]
				}
			}
		}
	};
	let saved = $state(false);
	let sheet = $state(false);
	let pace = $state('relaxed');
</script>

<Page title={s.name} back>
	<div class="flex flex-col gap-10 pb-35">
		<section class="flex flex-col items-start gap-3" data-clip-check>
			<Button>{s.button}</Button>
			<Button variant="secondary">{s.button}</Button>
			<Button variant="outline">{s.button}</Button>
			<Button variant="ghost">{s.button}</Button>
			<Button loading>{s.button}</Button>
			<Button variant="secondary" loading>{s.button}</Button>
			<Button disabled>{s.button}</Button>
			<Button variant="emergency">Call 112</Button>
			<div class="flex gap-2">
				<IconButton label="Save"><Heart size={20} aria-hidden="true" /></IconButton>
				<IconButton label="Share" glass><Share2 size={20} aria-hidden="true" /></IconButton>
				<IconButton label="Share" disabled><Share2 size={20} aria-hidden="true" /></IconButton>
			</div>
		</section>

		<section class="flex flex-col gap-3" data-clip-check>
			<div class="flex flex-wrap gap-2">
				<Chip>{s.chip}</Chip>
				<Chip selected>{s.chip}</Chip>
			</div>
			<TagList tags={s.tags} />
			<Segmented
				bind:value={pace}
				label="Pace"
				options={[
					{ value: 'relaxed', label: s.tags[0]! },
					{ value: 'balanced', label: s.tags[1]! },
					{ value: 'packed', label: s.tags[2]! }
				]}
			/>
		</section>

		<section class="flex flex-wrap gap-2" data-clip-check>
			<StatusBadge kind="tide" state="ok" label={s.label} />
			<StatusBadge kind="tide" state="cut" label={s.cut} />
			<StatusBadge kind="monsoon" state="open" label={s.label} />
			<StatusBadge kind="monsoon" state="risky" label={s.risky} />
			<StatusBadge kind="monsoon" state="closed" label={s.risky} />
			<StatusBadge kind="crowd" level="empty" live={false} />
			<StatusBadge kind="crowd" level="calm" live />
			<StatusBadge kind="crowd" level="busy" live />
			<StatusBadge kind="gem" />
			<StatusBadge kind="verified" />
			<StatusBadge kind="last-verified" date="2026-10-03" />
		</section>

		<section class="flex flex-col gap-3" data-clip-check>
			<div class="flex flex-wrap gap-2">
				{#each categories as c (c)}<CategoryIcon category={c} label={c} tile />{/each}
			</div>
			<div class="grid grid-cols-3 gap-2">
				{#each ['beach', 'fort', 'orchard'] as const as c (c)}
					<div class="aspect-[4/3] overflow-hidden rounded-lg"><NoPhoto category={c} /></div>
				{/each}
				{#each ['stay', 'eatery', 'dish'] as const as k (k)}
					<div class="aspect-[4/3] overflow-hidden rounded-lg"><NoPhoto kind={k} /></div>
				{/each}
			</div>
		</section>

		<section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<PlaceCard
				href="#"
				{names}
				category="temple"
				categoryLabel={s.cat}
				distanceKm={12.4}
				{saved}
				onsave={() => (saved = !saved)}
			>
				{#snippet badges()}
					<StatusBadge kind="gem" />
					<StatusBadge kind="crowd" level="calm" live glass />
				{/snippet}
				{#snippet verdict()}<MiniVerdict type="place" {agg} />{/snippet}
			</PlaceCard>
			<StayCard
				href="#"
				{names}
				tags={s.tags}
				priceMin={1800}
				priceMax={2500}
				priceSource="Agoda"
				serviceStyle="homely"
				onsave={() => {}}
			>
				{#snippet verdict()}<MiniVerdict type="stay" agg={fresh} />{/snippet}
			</StayCard>
			<EateryCard
				href="#"
				{names}
				authenticity={s.auth}
				signatureDish={s.dish}
				priceForTwo={650}
				diet={['veg', 'nonveg', 'jain']}
				onsave={() => {}}
			/>
		</section>

		<InsetList>
			<StayCard row href="#" {names} priceMin={1800} priceMax={2500} priceSource="Agoda">
				{#snippet verdict()}<MiniVerdict type="stay" {agg} />{/snippet}
			</StayCard>
			<EateryCard row href="#" {names} signatureDish={s.dish} onsave={() => {}} />
		</InsetList>

		<Carousel label={s.sub}>
			<li>
				<HeroCard href="#" {names} category="beach" sub={s.sub}>
					{#snippet badges()}<StatusBadge kind="gem" />{/snippet}
				</HeroCard>
			</li>
			<li><HeroCard href="#" names={{ en: s.line }} category="fort" sub={s.sub} /></li>
			<li><HeroCard href="#" names={{ en: s.dish }} kind="dish" /></li>
		</Carousel>

		<section class="flex max-w-105 flex-col gap-4">
			<Input id="g-email" label={s.input} type="email" />
			<Input id="g-search" label={s.input} search placeholder={s.line} />
			<Input id="g-err" label={s.input} error={s.risky} />
			<Input id="g-off" label={s.input} disabled value={s.line} />
		</section>

		<section class="grid gap-4 sm:grid-cols-2">
			<VerdictGauge type="place" all={agg} groups={{ couple: fresh }} />
			<VerdictGauge type="stay" all={null} groups={{}} />
		</section>
		<SubScores
			dims={['taste', 'hygiene']}
			subs={[
				{ dimension: 'taste', avg: 4.2, n: 12 },
				{ dimension: 'hygiene', avg: 3.6, n: 4 }
			]}
		/>
		<VerdictVote
			type="eatery"
			id="sample"
			dims={['taste', 'hygiene']}
			mine={{ verdicts: { family: 4 }, subs: { taste: 4 }, verified: false, proofPending: false }}
			signedIn
		/>

		<Facts
			rows={[
				{ label: s.cat, value: s.fact, icon: Clock },
				{ label: s.auth, value: '₹ 20', icon: Ticket },
				{ label: s.line, value: null, icon: Route }
			]}
		/>
		<PriceTable
			rows={[
				{ label: s.room, price: '₹ 2,400', source: 'Agoda', href: '#' },
				{ label: s.room, price: null, source: s.auth }
			]}
		/>
		<AudioGuide path="sample.mp3" transcript={s.fact} />
		<TideSlider slug="sample" lon={73.27} lat={17.15} preset={tide} />

		<ActionPreviewCard
			action={{
				id: 'a',
				type: 'edit_trip',
				preview: { title: s.sub, lines: [`+ ${s.line}`, `− ${s.cat}`, `↔ ${s.dish}`] }
			}}
			onact={() => {}}
		/>

		<section class="flex flex-col gap-4">
			<Skeleton shape="card" />
			<div class="rounded-lg bg-surface shadow-e1"><Skeleton shape="row" /></div>
			<Skeleton shape="text" />
		</section>

		<EmptyState title={s.button} body={s.name}>
			{#snippet action()}<Button>{s.button}</Button>{/snippet}
		</EmptyState>
		<ErrorState title={s.risky} body={s.name} art="fort">
			{#snippet action()}<Button variant="secondary">{s.button}</Button>{/snippet}
		</ErrorState>
		<ErrorState title={s.risky} body={s.name} art="boat" />

		<Button variant="ghost" onclick={() => toast(s.name)}>{s.button}</Button>
		<Button variant="secondary" onclick={() => (sheet = !sheet)}>{s.button}</Button>
	</div>
</Page>

{#if sheet}
	<BottomSheet>
		<p class="type-h2">{s.name}</p>
	</BottomSheet>
{/if}
