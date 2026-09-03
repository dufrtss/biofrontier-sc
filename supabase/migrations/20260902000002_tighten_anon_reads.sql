-- ============================================================================
-- BioFrontier SC — tighten anonymous read access.
--
-- Migration 0001 wrote the `identifications` and `profiles` read policies as
-- `using (true)` with no role restriction, which grants them to `anon` as well
-- as `authenticated`. Verified against the live project: an anonymous caller
-- could enumerate every identification — including reviewer user ids and
-- free-text comments attached to *pending* submissions that the same caller is
-- correctly forbidden from reading — and could enumerate every registered
-- contributor from `profiles`.
--
-- That contradicts the intent of `submissions_read_approved`: pending and
-- disputed material is for signed-in reviewers only. A contributor list is also
-- not something a public biodiversity map needs to hand to the open internet.
--
-- Fix: the base tables become authenticated-only for reads, and the anonymous
-- map layer is served exclusively by `public.approved_submissions`, which is
-- switched to run as its owner so it can still compute confirmation counts and
-- resolve an observer display name without granting access to the tables
-- underneath. The view exposes approved rows only, and no observer_id or notes.
-- ============================================================================

-- Anonymous callers no longer touch `submissions` directly; the view is the
-- only public surface, which keeps the exposed column set in one reviewable
-- place instead of two.
drop policy if exists submissions_read_approved on public.submissions;

drop policy if exists identifications_read on public.identifications;
create policy identifications_read on public.identifications
  for select to authenticated using (true);

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated using (true);

-- security_invoker = false: the view runs as `postgres`, which owns the base
-- tables and holds bypassrls, so `confirmation_count` and the observer display
-- name resolve for anonymous callers. Safe precisely because the view is
-- narrow — `where status = 'approved'`, and no observer identity beyond a
-- display name. Any column added here becomes public; add with that in mind.
create or replace view public.approved_submissions
with (security_invoker = false) as
select
  s.id,
  s.hex_id,
  s.latitude,
  s.longitude,
  s.observed_on,
  s.scientific_name,
  s.class_name,
  s.gbif_species_key,
  s.created_at,
  p.display_name as observer_display_name,
  (select count(*) from public.identifications i
    where i.submission_id = s.id and i.verdict = 'agree') as confirmation_count
from public.submissions s
left join public.profiles p on p.id = s.observer_id
where s.status = 'approved';

grant select on public.approved_submissions to anon, authenticated;
