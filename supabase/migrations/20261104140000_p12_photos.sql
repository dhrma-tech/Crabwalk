-- P12 step K (snap and ask, product plan 10.5): its own consent switch in Me. A photo the traveller sends goes
-- (EXIF/GPS stripped on the phone) to a Groq vision model to describe it; we never store the photo, and the
-- traveller's location is used only in our own matching. Off by default.
alter table public.user_profile add column use_photos boolean not null default false;
