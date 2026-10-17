-- P3: road flag provenance (DECISIONS P3-2) + idempotent OSM utility import.

-- Pipeline rows are 'auto'; team rows are 'team'. A team can veto an auto row with excluded = true
-- (re-runs keep it). The matrix pipeline ignores excluded rows.
alter table public.road_segments_flags
  add column source text not null default 'auto' check (source in ('auto', 'team')),
  add column excluded boolean not null default false;

create unique index utility_pois_osm_uniq on public.utility_pois (type, osm_id) where source = 'osm';
