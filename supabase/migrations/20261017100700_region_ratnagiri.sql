-- Reference data: first region and its talukas (B8). More regions = more rows, no code change.
-- Hindi/Marathi names pending team review.
with r as (
  insert into public.regions (name, code_prefix) values ('Ratnagiri', 'RTN') returning id
)
insert into public.talukas (region_id, name_en, name_hi, name_mr)
select r.id, t.name_en, t.name_hi, t.name_mr
from r, (values
  ('Mandangad', 'मंडणगड', 'मंडणगड'),
  ('Dapoli', 'दापोली', 'दापोली'),
  ('Khed', 'खेड', 'खेड'),
  ('Chiplun', 'चिपलून', 'चिपळूण'),
  ('Guhagar', 'गुहागर', 'गुहागर'),
  ('Sangameshwar', 'संगमेश्वर', 'संगमेश्वर'),
  ('Ratnagiri', 'रत्नागिरी', 'रत्नागिरी'),
  ('Lanja', 'लांजा', 'लांजा'),
  ('Rajapur', 'राजापुर', 'राजापूर')
) as t (name_en, name_hi, name_mr);
