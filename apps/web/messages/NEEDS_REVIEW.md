# HI / MR strings awaiting team review

FRONTEND §10: Marathi copy is written natively and team-reviewed. Every `hi.json` / `mr.json` key below is a Claude draft and **must be reviewed before launch**. When a key is approved, remove it from this list.

Status: **all keys in `hi.json` and `mr.json` are unreviewed** (P2 draft).

Points to check first:

- `nav_crabby`: mascot name in Devanagari (क्रैबी / क्रॅबी) or keep Latin "Crabby"?
- `crowd_typical`: "आम तौर पर" / "सहसा" — reads as a crowd suffix ("शांत · सहसा")?
- `verified` / `last_verified`: Hindi uses "जाँचा गया", Marathi "पडताळलेले".
- `login_code` (mr) uses a Devanagari digit (६); `hi` uses a Latin digit (6). Pick one convention.
- P3 map keys (`map_*`, `cat_*`, `util_*`, `tide_*`, `kind_*`): drafts. Check `tide_high`/`tide_low` (ज्वार/भाटा, भरती/ओहोटी), `cat_backwater` (खाडी), `cat_cave` (लेणी vs गुहा).
