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
