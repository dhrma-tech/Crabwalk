-- Extensions
create extension if not exists postgis with schema extensions;
create extension if not exists vector with schema extensions;

-- Shared enums
create type public.app_role as enum ('user', 'verifier', 'reviewer', 'owner', 'admin');
create type public.lang as enum ('en', 'hi', 'mr');
create type public.theme as enum ('system', 'light', 'dark');
create type public.group_type as enum ('family', 'couple', 'solo', 'friends');
create type public.entity_type as enum ('place', 'stay', 'eatery');
create type public.listing_type as enum ('place', 'stay', 'eatery', 'dish');
create type public.qr_entity_type as enum ('place', 'stay', 'eatery', 'station', 'bus_stand');
create type public.content_status as enum ('draft', 'in_review', 'published');
create type public.review_status as enum ('pending', 'approved', 'rejected');
create type public.service_style as enum ('homely', 'professional');

-- Private helper schema (not exposed through the API)
create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;

-- updated_at maintenance
create function app.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
