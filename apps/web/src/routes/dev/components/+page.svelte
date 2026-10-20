<script lang="ts">
	import { getLocale } from '#lib/paraglide/runtime.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import Chip from '#lib/components/Chip.svelte';
	import TagList from '#lib/components/TagList.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import PlaceCard from '#lib/components/PlaceCard.svelte';
	import StayCard from '#lib/components/StayCard.svelte';
	import EateryCard from '#lib/components/EateryCard.svelte';
	import Input from '#lib/components/Input.svelte';
	import Skeleton from '#lib/components/Skeleton.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import ErrorState from '#lib/components/ErrorState.svelte';
	import BottomSheet from '#lib/components/BottomSheet.svelte';
	import CategoryIcon, { type Category } from '#lib/components/CategoryIcon.svelte';
	import { toast } from '#lib/toast.svelte.ts';

	// Deliberately long strings per locale (FRONTEND §10: test with the longest Marathi string).
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
			input: 'Your email address for the code'
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
			input: 'कोड के लिए आपका ईमेल पता'
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
			input: 'कोडसाठी तुमचा ईमेल पत्ता'
		}
	}[getLocale()];

	const names = { en: 'Shree Ganpatipule Temple', mr: s.name };
	const categories: Category[] = [
		'beach',
		'fort',
		'temple',
		'waterfall',
		'viewpoint',
		'backwater',
		'cave',
		'museum',
		'village',
		'market',
		'orchard'
	];
	let saved = $state(false);
	let sheet = $state(false);
</script>

<Page title={s.name} back>
	<div class="flex flex-col gap-8 pb-[140px]">
		<section class="flex flex-col items-start gap-3" data-clip-check>
			<Button>{s.button}</Button>
			<Button variant="secondary">{s.button}</Button>
			<Button variant="ghost">{s.button}</Button>
			<Button loading>{s.button}</Button>
			<Button variant="emergency">Call 112</Button>
		</section>

		<section class="flex flex-wrap gap-2" data-clip-check>
			<Chip>{s.chip}</Chip>
			<Chip selected>{s.chip}</Chip>
			<TagList tags={s.tags} />
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

		<section class="flex flex-wrap gap-3 text-text-2" data-clip-check>
			{#each categories as c (c)}<CategoryIcon category={c} size={24} label={c} />{/each}
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
					<StatusBadge kind="crowd" level="calm" live={false} />
					<StatusBadge kind="tide" state="ok" label={s.label} />
				{/snippet}
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
			/>
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

		<section class="flex max-w-[420px] flex-col gap-4">
			<Input id="g-email" label={s.input} type="email" />
			<Input id="g-err" label={s.input} error={s.risky} />
		</section>

		<section class="flex flex-col gap-2 border border-border bg-surface p-4">
			<Skeleton class="h-32 w-full" />
			<Skeleton class="h-4 w-2/3" />
		</section>

		<EmptyState title={s.button} body={s.name}>
			{#snippet action()}<Button>{s.button}</Button>{/snippet}
		</EmptyState>
		<ErrorState title={s.risky} body={s.name}>
			{#snippet action()}<Button variant="secondary">{s.button}</Button>{/snippet}
		</ErrorState>

		<Button variant="ghost" onclick={() => toast(s.name)}>{s.button}</Button>
		<Button variant="secondary" onclick={() => (sheet = !sheet)}>{s.button}</Button>
	</div>
</Page>

{#if sheet}
	<BottomSheet>
		<p class="type-h2">{s.name}</p>
	</BottomSheet>
{/if}
