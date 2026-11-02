-- Photo credits (phase-10b, DECISIONS T-7 / T-51): our own photos, or openly licensed ones (CC BY / CC BY-SA,
-- e.g. Wikimedia Commons) with author, licence and source shown under the image. Never unlicensed web images.
-- All three empty = our own photo; all three filled = a licensed photo. Nothing in between.
alter table public.photos
  add column credit text check (char_length(credit) between 1 and 200),
  add column licence text check (licence in (
    'CC BY 4.0', 'CC BY-SA 4.0', 'CC BY 3.0', 'CC BY-SA 3.0',
    'CC BY 2.5', 'CC BY-SA 2.5', 'CC BY 2.0', 'CC BY-SA 2.0')),
  add column source_url text check (source_url ~ '^https://\S+$' and char_length(source_url) <= 500),
  add constraint photos_credit_all_or_none check (
    (credit is null and licence is null and source_url is null)
    or (credit is not null and licence is not null and source_url is not null));
