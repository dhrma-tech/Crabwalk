-- Photo credits are fixed in review (DECISIONS T-51): staff for a listing may update its photos (author, licence,
-- source) even when someone else uploaded them. The existing "staff or owner write" policy only lets the uploader
-- change a row (with check uploaded_by = auth.uid()); inserts keep that rule.
create policy "staff update" on public.photos for update
  using (app.is_staff_for(entity_type, entity_id))
  with check (app.is_staff_for(entity_type, entity_id));
