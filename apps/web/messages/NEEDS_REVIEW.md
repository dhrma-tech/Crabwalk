# HI / MR strings awaiting team review

FRONTEND §10: Marathi copy is written natively and team-reviewed. Every `hi.json` / `mr.json` key below is a Claude draft and **must be reviewed before launch**. When a key is approved, remove it from this list.

Status: **all keys in `hi.json` and `mr.json` are unreviewed** (P2 draft).

Points to check first:

- `nav_crabby`: mascot name in Devanagari (क्रैबी / क्रॅबी) or keep Latin "Crabby"?
- `crowd_typical`: "आम तौर पर" / "सहसा" — reads as a crowd suffix ("शांत · सहसा")?
- `verified` / `last_verified`: Hindi uses "जाँचा गया", Marathi "पडताळलेले".
- `login_code` (mr) uses a Devanagari digit (६); `hi` uses a Latin digit (6). Pick one convention.
- P3 map keys (`map_*`, `cat_*`, `util_*`, `tide_*`, `kind_*`): drafts. Check `tide_high`/`tide_low` (ज्वार/भाटा, भरती/ओहोटी), `cat_backwater` (खाडी), `cat_cave` (लेणी vs गुहा).
- P4 keys (listing pages, admin/field/review/reports/claims, owner): drafts. Check domain terms first: `type_eatery` (भोजनालय/खानावळ), `field_lon` (देशांतर vs रेखांश), `food_malvani`, `vibe_*`.
- P5 keys (`verdict_*`, `group_*`, `dim_*`, reviews, proofs): drafts. Verdict labels are LOCKED in English (BACKEND §5); check the HI/MR equivalents carry the same tone (टाइमपास, स्थानिक प्रसिद्ध).
- P6 keys (`qr_*`, `start_*`): drafts. Check the emergency copy first (`qr_call_112`, `qr_share_location`, `qr_share_text`, `qr_emergency`) and `qr_plaque_scan` (printed on plaques — review before printing).
- P7 keys (`plan_*`, `pace_*`, `budget_*`, `reason_*`, `gvote_*`, `itin_*`, `route_*`, `event_*`, `routes_*`, `planner_*`, `me_trips`, `field_fee_inr`, `field_visit_minutes`): drafts. `reason_*` text is saved on trip stops, so review before launch.
- P8 keys (`crabby_*`, `emergency_*`, `privacy_*`, `me_prefs*`, `budget_level_*`, `moderation_ai_*`, `review_ai_*`, `similar_title`, `less_crowded_title`, `plan_merge_*`): drafts. **Emergency copy and the privacy AI section first.** Also review the emergency keyword list in `src/lib/emergency.ts` (EN/HI/MR + romanised) — it decides when the 112 card appears.
- P9 keys (`nav_*`, `turn_*`, `live_*`, `nudge_*`, `push_*`, `dwell_*`, `consent*`, `packs_*`, `offline_*`, `layer*`, `heat_*`, `tide_*`, `alert*`, `severity_*`, `trail_*`, `trending_title`, `underrated_*`, `plan_suggest_*`, `plan_offline_*`): drafts. **Turn instructions are spoken aloud while driving — check them first**, then the dwell consent text (DPDPA) and trail difficulty definitions.
- Phase-10b keys (`today_*`, `wx_*`, `search_recent`, `search_kind_*`, `itin_budget`, `meta_category`, `map_see_on_map`, `map_open_listing`, `map_in_view*`, `layers_show`, `layers_live`, `results_count`, `sort_*`, `filter_clear`, `filter_up_to`, `amenity_missing`, `filters_clear_all`, `dish_best_here`, `plan_step`, `plan_next`): drafts. Check `today_low_tide` (भाटा / ओहोटी) and the weather words first; `meta_category` is the search-result snippet for each Discover category.
