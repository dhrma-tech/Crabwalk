# Field forms vs app values

Source of truth: the Drive field forms (*Crabwalk Field STANDARD Form – Places*, *Field Form – Stays and Hotels*, *Field Form – Food*) and the data templates (`data/_templates/templates.md`). Choice answers are read the forms' own way: lowercase, spaces → underscores, Yes/No → true/false, "Not known" → null.

Rule used: **only exact 1:1 mappings were applied.** Anything that needs a judgement call is listed under "Needs your decision"; that data was left as it is.

## Applied (exact 1:1)

| # | Form | App before | Change |
|---|---|---|---|
| A1 | Phone, WhatsApp, owner phone, permission phone: *"10 digits, no +91, no spaces"* | Desk data stored `+91 XXXXX XXXXX` / `+91 <STD> <number>` (`data/README.md` format note) | All 151 stay/eatery phone and WhatsApp values now hold the same digits as 10 digits (migration `20261107100000`, step 4). The editor already saves 10 digits. Call and WhatsApp links add the country code back (`lib/phone.ts`: `tel:+91…`, `wa.me/91…`), so mobiles and landlines both still dial. |
| A2 | Stays *Wi-Fi?* Yes / No | `amenities.wifi` true / false (shown in the app) | One field. The editor's Wi-Fi question now edits `amenities.wifi` (the separate form-only answer was removed; no data had been saved in it). |

## Already identical (no change)

| Form | App |
|---|---|
| Place type (beach … orchard) | `place_category` enum |
| Taluka list | `talukas` rows (matched by name; app shows capitalised names) |
| Monsoon status open / risky / closed | `monsoon_status` |
| Crowd empty / calm / busy | `crowd_level` |
| Delivery yes / no / not checked | `food_delivery.<app>` true / false / null |
| Service style homely / professional | `service_style` |
| Vibe tags (max 4) | `vibe_tags` (same 9 values; DB checks the list) |
| Authenticity home style / local legend / tourist oriented | `eatery_authenticity` |
| Jain food available? | `diet_flags.jain` |
| Swiggy / Zomato / Magicpin / EatSure + links | `food_apps.<app>.available` / `.link` |
| Visited in person? | `is_verified` |
| Normal season lowest / highest | `price_min` / `price_max` |
| Booking links (Agoda, MakeMyTrip, Booking.com, Airbnb, Goibibo, other) | `stay_offers.provider` |
| Useful places nearby types (fuel … ferry jetty) | same 11 values as `utility_type` |
| Food at stay veg / non-veg / jain | `food_at_stay.veg` / `.non_veg` / `.jain` |
| Event type festival / jatra / season (template) | `events_calendar.type` |
| Form status draft / ready / approved | `content_status` draft / in_review / published (labels in the editor read Draft / Ready for review / Approved; DB names unchanged) |

## Needs your decision (data left as is)

| # | Form | App | Question |
|---|---|---|---|
| D1 | Network per operator: none / weak / ok / strong / not tested | `network_strength.<operator>`: none / weak / good | Is `good` = `ok`, `strong`, or both? Until decided the editor keeps both: the form answer (form values) and the app value (app values). No stay has app network data yet. |
| D2 | AC: all rooms / some rooms / none | `amenities.ac` true / false | Does "some rooms" count as AC = yes? |
| D3 | Hot water: 24 hours / fixed hours / on request / none | `amenities.hot_water` true / false | Do "fixed hours" and "on request" count as yes? |
| D4 | Power backup: full / partial / none | `amenities.power_backup` true / false | Does "partial" count as yes? |
| D5 | Parking (stays): car and bike / bike only / street / none | `amenities.parking` true / false | Does "street" count as parking? |
| D6 | Where is the price from? owner / board at reception | `price_source`: owner / agoda / affiliate / listed_online | `owner` matches; "board at reception" has no app value. Add one, or treat it as `owner`? |
| D7 | Homemade food? | `food_at_stay.homemade_included` | The template key says "included" (in the price?); the form asks only "homemade?". Same thing? |
| D8 | Food served: veg only / veg and non veg / mostly non veg | `diet_flags.veg` / `.non_veg` | "veg only" → veg yes, non-veg no; "veg and non veg" → both yes; is "mostly non veg" → veg yes or no? |
| D9 | Special seasons: turtle nesting / mango / firefly / waterfall / **festival / birds / other** | `season` enum: the first four only | Add festival, birds and other to the app (they appear on the public Today strip and need HI/MR labels)? |
| D10 | Do we know the timings? + opens / closes / closed on | `place_hours` rows (one per weekday, `hours_unknown` per row) | Should "No" write `hours_unknown` rows for all 7 days, and should opens/closes fill all open weekdays? |
| D11 | Crowd on weekdays / weekends / peak / monsoon | `crowd_typical` rows (per weekday, optional season) | How do the four answers map onto weekday rows? |
| D12 | QR permission status: not asked / requested / approved / rejected | `qr_codes.permission_status`: pending / granted | requested → pending and approved → granted are clear; where do "not asked" and "rejected" go? |
| D13 | Menu items (name, price, veg / egg / non veg / jain, dish ID) | `eateries.menu.items`: plain text lines shown in the app | Should the app show the structured items (needs a page change), or generate lines like "Surmai thali · ₹350"? |
| D14 | Signature dishes: name on menu, price, type per dish | `eatery_dishes`: dish, signature, best-for, note | Store the extra three per link (new columns), or keep them in the menu items? |
| D15 | Entry fee: free / paid + fee for adult | `entry_fee_inr` (0 = free?) | Should "free" set `entry_fee_inr = 0`? |
| D16 | Hidden gem / tide dependent / visited in person: Yes / No | `is_hidden_gem`, `is_tide_dependent`, `is_verified` are NOT NULL (default false) | Make them nullable so "Not known" can be stored? (Today Unknown can't be saved for these three.) |
