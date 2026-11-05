# Crabwalk data collection

Collected desk data for the Ratnagiri MVP. Spec: `docs/DATA_REQUIREMENTS.md`. Every row is `status: ai_draft` and must be human-verified before import.

## Progress (min targets)

| Taluka | Places | With EN text | With coords | With photo | Eateries | Stays |
|---|---|---|---|---|---|---|
| Mandangad | 13/8 | 13 | 4 | 2 | 4/4 | 5/3 |
| Dapoli | 26/16 | 24 | 9 | 14 | 13/8 | 13/8 |
| Khed | 15/9 | 13 | 11 | 6 | 11/5 | 7/4 |
| Chiplun | 15/10 | 14 | 8 | 5 | 14/8 | 10/5 |
| Guhagar | 20/12 | 19 | 12 | 9 | 12/6 | 12/6 |
| Sangameshwar | 18/9 | 17 | 7 | 3 | 11/5 | 8/4 |
| Ratnagiri | 34/18 | 34 | 26 | 14 | 14/10 | 19/8 |
| Lanja | 11/7 | 8 | 3 | 0 | 8/3 | 4/3 |
| Rajapur | 19/11 | 18 | 16 | 4 | 11/5 | 7/4 |
| **Total** | **171/100** | **163** | **96** | **57** | **98/54** | **85/45** |

| Entity | File | Count / min target | State |
|---|---|---|---|
| Dishes | `dishes/dishes.yaml` | 25 / 8 (ideal 25) | EN done; MR/HI names, one-liners and stories by Gemini (needs native review); photos pending |
| Events | `events/events-2026-27.yaml` | 41 / 19 (ideal 45) | district festivals + jatras in all 9 talukas; lunar dates derived from panchang, confirm locally |
| Seasonal highlights | `seasonal/place_seasonal.yaml` | 11 / 12 | turtle 4, waterfall 7; mango and firefly 0 (no orchard place / no district source) |
| Ready-made itineraries | `itineraries/itineraries.yaml` | 7 / 5 | drafts from our listings; plan in app before publishing |
| Reference (fuel price, tide places) | `reference/reference.yaml` | - | petrol price: 3 sites disagree (105.82-113.17), value left null |
| Hospitals + police | `utilities/hospitals-police.yaml` | 18 + 18 / 27 | official phones for 6 hospitals + all police; 1 private hospital phone from Maps; 11 govt hospitals have no public phone (call to collect) |
| Place text EN (story, history, significance, dos, donts, safety) | in place files | 163 / 171 | 91 Claude drafts from sources; 72 Gemini drafts with sources (batches T-1, T-2: check facts); 8 blank (no reliable source or wrong-place text removed); 3 need a fact check (Palshet Caves, Kasheli Sunset Point, Rani Laxmibai Memorial, see `_review`) |
| Place text MR + HI | in place files | 163 / 171 | Gemini translation of the EN drafts; auto-checked (`_logs/translation-check.md`); needs native review |
| Place names MR + HI | in place files | 171 / 171 | Gemini; some MR names expanded (listed in translation-check.md) |
| New places batch P-F | in place files | 68 | identity + facts by Gemini (Search); unsourced values dropped; monsoon status is a category default; no text yet; Dapoli/Khed/Sangameshwar rows used Gemini fallback model: LOW TRUST |
| Stay + eatery descriptions EN/MR/HI | in stay/eatery files | 102 / 102 | Gemini; 52 written from Google Maps facts, 50 from our own fields only (vibe, food, service style); no banned hype words; needs review |
| Stay + eatery names MR/HI | in stay/eatery files | 102 / 102 | Gemini, then cleaned: names are a transliteration of `name_en` only (area dropped unless part of the name) |
| Photos (Commons, URL + credit only) | `photos/manifest.yaml` | 57 / 171 | not downloaded; licence must be re-checked |

## How the data was collected
- Places: candidate list by Claude (repo OSM extract `pipelines/data/region.osm.pbf` + known attractions). Facts by Gemini (Google Search, in browser) + Claude (Wikipedia, Wikivoyage, ratnagiri.gov.in), then cleaned by Claude. Wrong or weakly sourced Gemini values were dropped and noted in `_review`.
- Coordinates: only from the repo OSM extract (`coord_source`). No LLM coordinates. `null` = needs a pin.
- Eateries/stays: Gemini with Google Maps. Batch 2 (37 stays, 44 eateries; 2 out-of-district stays dropped, 5 moved to the right taluka) took place IDs from the Gemini Maps tool without a separate re-check.
- Pins batch 2: 9 from OSM Nominatim / Wikidata (coord_source says which); Wikipedia village coordinates were not used as place pins.
- Batch 1: every eatery and stay is confirmed on Google Maps (google_place_id). 22 eateries and 2 stays from directory pages were not on Maps and were removed (see rejected.md).
- Official district tourism page (ratnagiri.gov.in/about-district/tourism/) used as identity source for several places; it also gave MTDC resort phones. Phones are public business listing numbers, unverified.
- `_sources._all` holds the per-row source list (per-field mapping is lost for Gemini rows, see Q4).

## Format notes
- Phones are normalised to `+91 XXXXX XXXXX` (mobile) or `+91 <STD> <number>` (landline). Digits are Western (0-9) everywhere.
- All place rows share one field order. Stays and eateries have no `lat`/`lng` (null); resolve pins from `google_place_id` at import or leave them off the map.
- The 25 batch P-F rows in Dapoli, Khed and Sangameshwar are LOW TRUST; a 2026-11-04 re-check returned no better data and was not merged (see `_logs/validation.md`).

## Trust levels
- High: hospital/police phones (official district site), festival dates (Drik Panchang), Wikipedia-backed place identity.
- Medium: place how-to-reach, Marathi names (AI-DRAFT), eatery identity from Maps.
- Low: rows with `LOW TRUST` or weak sources in `_review`; timings/fees from blogs.

## Validate
`python data/_scripts/validate.py` → `data/_logs/validation.md`. Rejected candidates: `data/_logs/rejected.md`.

## Working files
- `_work/translations/tr-0..7.json`: raw Gemini translation batches (source of the MR/HI text). Keep for audit or delete.
- `_work/receiver.ps1`: temporary local receiver used to save batches; stopped; safe to delete. `_work/translations/tr-4.raw.json` is an empty leftover.
