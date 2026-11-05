### 4.4 YAML formats

Keys map 1:1 to DB columns, or to importer columns where one exists. `_sources` is per field (M9).

```yaml
# places — batches P-A…P-E merged into one record
- slug: ratnadurg-fort
  status: ai_draft
  name_en: Ratnadurg Fort
  name_mr: null
  name_hi: null
  category: fort            # beach|fort|temple|waterfall|viewpoint|backwater|cave|museum|village|market|orchard
  taluka: Ratnagiri         # Mandangad|Dapoli|Khed|Chiplun|Guhagar|Sangameshwar|Ratnagiri|Lanja|Rajapur
  lat: null                 # see Q6
  lng: null
  entry_fee_text: null
  entry_fee_inr: null       # int, adult, ₹
  visit_minutes: null       # 10–600
  opens: null               # "HH:MM"
  closes: null
  closed_days: []           # [mon, tue, …]
  best_time: null
  how_to_reach: null
  nearest_station: null
  nearest_bus_stop: null
  monsoon_status: open      # open|risky|closed
  monsoon_reason: null
  is_tide_dependent: false
  is_hidden_gem: false      # FIELD-ONLY; AI must leave false (Q8)
  seasons: []               # [{season: turtle_nesting|mango|firefly|waterfall, from_month: 1-12, to_month: 1-12}]
  text:
    en: {short_story: null, history: null, significance: null, dos: null, donts: null, safety_text: null}
    mr: {short_story: null, history: null, significance: null, dos: null, donts: null, safety_text: null}
    hi: {short_story: null, history: null, significance: null, dos: null, donts: null, safety_text: null}
  photo: {file_url: null, credit: null, licence: null, source_url: null}
  _sources:
    name_en: [https://…]
    entry_fee_text: [https://…]
```

```yaml
# stays
- slug: null
  status: ai_draft
  name_en: null
  name_mr: null
  name_hi: null
  taluka: null
  lat: null
  lng: null
  service_style: null       # homely|professional
  vibe_tags: []             # traditional_konkani_home|family|luxury|business|backpacker|couple_friendly|pet_friendly|beachfront|orchard_stay
  food_at_stay: {veg: null, non_veg: null, malvani: null, jain: null, homemade_included: null}
  price_min: null           # ₹/night int
  price_max: null
  phone: null
  whatsapp: null
  description: {en: null, mr: null, hi: null}
  ota_links: []             # [{provider: booking_com|makemytrip|agoda|…, url: https://…}] — Q12
  _sources: {}
  # FIELD-ONLY, not in AI output: amenities, network_strength, is_verified, photos
```

```yaml
# dishes
- slug: solkadhi            # ^[a-z][a-z0-9_-]{1,40}$
  status: ai_draft
  name: {en: Solkadhi, mr: null, hi: null}
  what_it_is: {en: null, mr: null, hi: null}
  story: {en: null, mr: null, hi: null}
  photo: {file_url: null, credit: null, licence: null, source_url: null}
  _sources: {}
```

```yaml
# eateries
- slug: null
  status: ai_draft
  name_en: null
  name_mr: null
  name_hi: null
  taluka: null
  lat: null
  lng: null
  authenticity: null        # home_style|local_legend|tourist_oriented
  price_for_two: null       # ₹ int
  diet_flags: {veg: null, non_veg: null, jain: null}
  opens: null
  closes: null
  closed_days: []
  food_apps:
    swiggy: {available: null, link: null}
    zomato: {available: null, link: null}
    eatsure: {available: null, link: null}
    magicpin: {available: null, link: null}
  menu: {items: []}
  dishes: []                # [{slug: solkadhi, is_signature: true, is_best_for: false}] max 10, slugs from dishes file
  phone: null
  whatsapp: null
  description: {en: null, mr: null, hi: null}
  _sources: {}
```

```yaml
# events
- status: ai_draft
  name: {en: null, mr: null, hi: null}
  type: null                # festival|jatra|season
  from_date: null           # YYYY-MM-DD
  to_date: null
  taluka: null              # null = district-wide
  impact: {crowd: null, closures: null}   # crowd: busy|calm
  _sources: {}
```

```yaml
# utilities (hospital / police verification)
- osm_id: null              # from the OSM row being checked
  type: hospital
  taluka: null
  name: null
  phone: null
  emergency_24h: null       # not in schema (Q13)
  is_real_hospital: null    # false = clinic, mark for review
  _sources: {}
```

