-- Report 1 §3.1: no security-definer function is executable through PUBLIC. These seven still carried the
-- PUBLIC grant every new function gets; each keeps its explicit anon/authenticated/service_role entries, so
-- behaviour is unchanged. Default privileges are left alone on purpose (DECISIONS T-15): the per-schema form is a
-- no-op and the global form would strip EXECUTE from helpers in every schema. function_privileges.test.sql
-- fails on any definer function that still has PUBLIC, so new ones need an explicit revoke.
revoke execute on function public.cast_group_vote(text, text, text, uuid, text) from public;
revoke execute on function public.get_shared_trip(text) from public;
revoke execute on function public.map_heatmap(double precision, double precision, double precision, double precision) from public;
revoke execute on function public.qr_record_scan(text, text, public.lang, double precision, double precision) from public;
revoke execute on function public.rate_take(text, integer, integer) from public;
revoke execute on function public.sub_score_summary(public.entity_type, uuid) from public;
revoke execute on function public.trip_vote_counts(text) from public;
