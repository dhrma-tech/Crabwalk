"""Validate Crabwalk collected data (docs/DATA_REQUIREMENTS.md §4.5).
Usage: python data/_scripts/validate.py   (from repo root). Writes data/_logs/validation.md
Requires: pyyaml (pip install pyyaml)."""
import re, sys, glob, os, math, difflib, yaml
ROOT = os.path.join(os.path.dirname(__file__), '..')
TAL = {'Mandangad','Dapoli','Khed','Chiplun','Guhagar','Sangameshwar','Ratnagiri','Lanja','Rajapur'}
CAT = {'beach','fort','temple','waterfall','viewpoint','backwater','cave','museum','village','market','orchard'}
DAYS = {'mon','tue','wed','thu','fri','sat','sun'}
SEASON = {'turtle_nesting','mango','firefly','waterfall'}
SLUG = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$'); DSLUG = re.compile(r'^[a-z][a-z0-9_-]{1,40}$')
HHMM = re.compile(r'^([01]\d|2[0-3]):[0-5]\d$'); PHONE = re.compile(r'^\+?[\d\s-]{6,20}$')
DEVA = re.compile(r'[ऀ-ॿ]'); CONTACT = re.compile(r'(\+?\d[\d\s-]{8,}\d)|(\S+@\S+\.\w+)')
FACT_KEYS = {'entry_fee_text','entry_fee_inr','opens','closes','best_time','how_to_reach','nearest_station','nearest_bus_stop','monsoon_reason','visit_minutes','price_min','price_max','price_for_two','phone','authenticity'}
errs, warns = [], []
def E(f, s, m): errs.append(f'{f} :: {s} :: {m}')
def W(f, s, m): warns.append(f'{f} :: {s} :: {m}')
def https_list(v): return isinstance(v, list) and v and all(isinstance(u, str) and u.startswith('https://') for u in v)
def check_sources(f, s, r):
    src = r.get('_sources') or {}
    for k in FACT_KEYS:
        if r.get(k) not in (None, [], {}) and k not in src and not src.get('_all'):
            W(f, s, f'fact {k} has no _sources entry')
    for k, v in src.items():
        if not https_list(v): E(f, s, f'_sources.{k} must be a list of https URLs')
def text_ok(f, s, label, t, lang):
    if t is None: return
    if lang in ('mr','hi') and not DEVA.search(str(t)): E(f, s, f'{label} not Devanagari')
    if CONTACT.search(str(t)) and label not in ('name',): E(f, s, f'{label} contains phone/email')
def dist(a, b):
    R=6371000; p1,p2=math.radians(a[0]),math.radians(b[0]); dp=p2-p1; dl=math.radians(b[1]-a[1])
    return 2*R*math.asin(math.sqrt(math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2))
listings = []
def load(p):
    try: return yaml.safe_load(open(p, encoding='utf-8')) or []
    except Exception as e: E(p, '-', f'YAML parse error: {e}'); return []
slugs = {}
for p in sorted(glob.glob(f'{ROOT}/places/*.yaml')):
    if os.path.basename(p).startswith('_'): continue
    for r in load(p):
        s = r.get('slug'); f = os.path.basename(p)
        if not s or not SLUG.match(s) or len(s) > 60: E(f, s, 'bad slug')
        if s in slugs: E(f, s, f'duplicate slug (also {slugs[s]})')
        slugs[s] = f
        if r.get('status') not in ('ai_draft', 'rejected'): E(f, s, 'status must be ai_draft')
        if r.get('status') == 'rejected': continue
        n = r.get('name_en') or ''
        if not 2 <= len(n) <= 120: E(f, s, 'name_en length')
        if r.get('category') not in CAT: E(f, s, f"category {r.get('category')}")
        if r.get('taluka') not in TAL: E(f, s, f"taluka {r.get('taluka')}")
        if r.get('monsoon_status') not in ('open','risky','closed'): E(f, s, 'monsoon_status')
        if r.get('monsoon_status') in ('risky','closed') and not r.get('monsoon_reason'): E(f, s, 'monsoon_reason required')
        if r.get('is_hidden_gem'): E(f, s, 'is_hidden_gem must be false on desk rows')
        if (r.get('opens') is None) != (r.get('closes') is None): E(f, s, 'opens/closes both or neither')
        for k in ('opens','closes'):
            if r.get(k) and not HHMM.match(str(r[k])): E(f, s, f'{k} not HH:MM')
        if not set(r.get('closed_days') or []) <= DAYS: E(f, s, 'closed_days values')
        fee = r.get('entry_fee_inr')
        if fee is not None and not (isinstance(fee, int) and 0 <= fee <= 100000): E(f, s, 'entry_fee_inr')
        vm = r.get('visit_minutes')
        if vm is not None and not (isinstance(vm, int) and 10 <= vm <= 600): E(f, s, 'visit_minutes 10-600')
        for z in r.get('seasons') or []:
            if z.get('season') not in SEASON or not (1 <= int(z.get('from_month', 0)) <= 12 and 1 <= int(z.get('to_month', 0)) <= 12): E(f, s, f'season {z}')
        for k in ('best_time','how_to_reach','nearest_station','nearest_bus_stop','monsoon_reason','entry_fee_text'):
            if r.get(k) and len(str(r[k])) > 1000: E(f, s, f'{k} > 1000 chars')
        if r.get('name_mr'): text_ok(f, s, 'name_mr', r['name_mr'], 'mr')
        if r.get('name_hi'): text_ok(f, s, 'name_hi', r['name_hi'], 'hi')
        for lang, block in (r.get('text') or {}).items():
            for k, t in (block or {}).items():
                if t and len(str(t)) > 5000: E(f, s, f'text.{lang}.{k} > 5000')
                text_ok(f, s, f'text.{lang}.{k}', t, lang)
        if r.get('lat') is None or r.get('lng') is None: W(f, s, 'no coordinates (needs pin)')
        else:
            if not (15.5 < r['lat'] < 18.5 and 72.5 < r['lng'] < 74.5): E(f, s, 'coordinates outside Ratnagiri bbox')
            listings.append((s, n, (r['lat'], r['lng'])))
        if not r.get('_sources'): E(f, s, 'no sources at all')
        check_sources(f, s, r)
        ph = r.get('photo') or {}
        trio = [ph.get('credit'), ph.get('licence'), ph.get('source_url')]
        if any(trio) and not all(trio): E(f, s, 'photo credit/licence/source_url all or none')
        allowed = {'slug','status','name_en','name_mr','name_hi','category','taluka','lat','lng','coord_source','osm_id','wikidata','entry_fee_text','entry_fee_inr','visit_minutes','opens','closes','closed_days','best_time','how_to_reach','nearest_station','nearest_bus_stop','monsoon_status','monsoon_reason','is_tide_dependent','is_hidden_gem','seasons','text','photo','wikipedia_url','_sources','_review','_collected_by'}
        extra = set(r) - allowed
        if extra: E(f, s, f'unknown keys {sorted(extra)}')
for i in range(len(listings)):
    for j in range(i+1, len(listings)):
        a, b = listings[i], listings[j]
        if dist(a[2], b[2]) < 150 and difflib.SequenceMatcher(None, a[1].lower(), b[1].lower()).ratio() > 0.6:
            W('places', f'{a[0]}~{b[0]}', 'possible duplicate (<150 m, similar name)')
for p in glob.glob(f'{ROOT}/dishes/*.yaml'):
    for r in load(p):
        s = r.get('slug')
        if not s or not DSLUG.match(s): E('dishes', s, 'bad dish slug')
        for lang in ('mr','hi'):
            text_ok('dishes', s, f'name.{lang}', (r.get('name') or {}).get(lang), lang)
        if not r.get('_sources'): E('dishes', s, 'no sources')
for p in glob.glob(f'{ROOT}/events/*.yaml'):
    for r in load(p):
        s = (r.get('name') or {}).get('en')
        if r.get('type') not in ('festival','jatra','season'): E('events', s, 'type')
        if not r.get('from_date') or not r.get('to_date') or str(r['to_date']) < str(r['from_date']): E('events', s, 'dates')
        if r.get('taluka') not in TAL | {None}: E('events', s, 'taluka')
for p in glob.glob(f'{ROOT}/utilities/*.yaml'):
    for r in load(p):
        s = r.get('name')
        if r.get('phone') and not PHONE.match(r['phone']): E('utilities', s, 'phone format')
        if r.get('taluka') not in TAL: E('utilities', s, 'taluka')
        if r.get('phone') and not (r.get('_sources') or {}).get('phone'): E('utilities', s, 'phone without source')
for sub in ('eateries','stays'):
    for p in glob.glob(f'{ROOT}/{sub}/*.yaml'):
        f = os.path.basename(p)
        for r in load(p):
            s = r.get('slug')
            if not s or not SLUG.match(s): E(f, s, 'bad slug')
            if r.get('taluka') not in TAL: E(f, s, 'taluka')
            for k in ('phone','whatsapp'):
                if r.get(k) and not PHONE.match(str(r[k])): E(f, s, f'{k} format')
            if sub == 'eateries':
                if r.get('authenticity') not in ('home_style','local_legend','tourist_oriented', None): E(f, s, 'authenticity')
                if len(r.get('dishes') or []) > 10: E(f, s, '> 10 dish links')
                for app, v in (r.get('food_apps') or {}).items():
                    if v and v.get('link') and not str(v['link']).startswith('https://'): E(f, s, f'{app} link not https')
            if sub == 'stays':
                if r.get('price_min') and r.get('price_max') and r['price_max'] < r['price_min']: E(f, s, 'price_max < price_min')
            check_sources(f, s, r)
out = [f'# Validation report\n', f'Errors: {len(errs)} | Warnings: {len(warns)}\n', '## Errors'] + [f'- {e}' for e in errs] + ['', '## Warnings'] + [f'- {w}' for w in warns]
os.makedirs(f'{ROOT}/_logs', exist_ok=True)
open(f'{ROOT}/_logs/validation.md', 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print(f'errors={len(errs)} warnings={len(warns)} -> data/_logs/validation.md')
sys.exit(1 if errs else 0)
