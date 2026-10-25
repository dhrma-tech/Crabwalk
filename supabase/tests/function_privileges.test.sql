-- Report 1 §3.1: no security-definer function in public is executable through PUBLIC (new ones need an
-- explicit revoke). Which definer functions anon may call is the allowlist in p10_hardening.test.sql.
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

select is(
  (select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                 where a.grantee = 0 and a.privilege_type = 'EXECUTE')),
  '', 'no security-definer function in public is executable through PUBLIC');

-- The guard notices a new definer function that forgot its revoke.
create function public._t_forgot_revoke() returns int language sql security definer set search_path = '' as $$ select 1 $$;
select is(
  (select count(*)::int from pg_proc p
   where p.proname = '_t_forgot_revoke'
     and exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                 where a.grantee = 0 and a.privilege_type = 'EXECUTE')),
  1, 'a new definer function without a revoke is caught');

select * from finish();
rollback;
