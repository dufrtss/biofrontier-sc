-- ============================================================================
-- BioFrontier SC — Community Contributions, Phase 1
--
-- Implements the schema half of the decision recorded in
-- `.claude/decisions/biofrontier-community-contributions.md`:
--
--   * biology students and specialists submit occurrence observations in-app,
--   * nothing submitted is trusted by default,
--   * review is PEER CONSENSUS (iNaturalist-style), not a single-expert gate,
--   * an expert tier is additive later, so the audit trail is role-aware from
--     the start even though no experts are assigned yet,
--   * approved records stay OUT of the frontier-score math until Phase 2 —
--     nothing here writes to the scoring pipeline; the app reads approved rows
--     as a separate marker layer only.
--
-- Idempotent: safe to re-run.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Roles. `member` is every registered user. `expert` and `admin` exist now so
-- that the audit trail can record them; nothing grants them yet. Adding the
-- expert review tier later is then a policy change, not a migration of history.
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('member', 'expert', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.submission_status as enum ('pending', 'approved', 'disputed', 'withdrawn');
exception when duplicate_object then null; end $$;

-- An identification is either agreement with the observer's name, or a
-- competing name. `disagree` without a name means "this is not that species,
-- and I can't say what it is" — still useful signal, so it is allowed.
do $$ begin
  create type public.identification_verdict as enum ('agree', 'disagree');
exception when duplicate_object then null; end $$;


-- ---------------------------------------------------------------------------
-- profiles — one row per auth user, created automatically on signup.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  institution  text,
  role         public.user_role not null default 'member',
  created_at   timestamptz not null default now()
);

comment on table public.profiles is
  'Public-facing identity for a registered contributor. Role is set by an admin out of band; signup always yields ''member''.';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------------
-- submissions — one observation.
--
-- `hex_id` is the H3 resolution-6 cell the point falls in, matching the app's
-- grid so a submission joins straight onto a hexbin. It is stored rather than
-- derived because Postgres has no H3 extension enabled here; the client
-- computes it with h3-js (the same library the scoring pipeline uses) and a
-- CHECK constrains the shape. `class_name` is the raw taxonomic class, exactly
-- as `Occurrence.className` carries it — the app maps class to taxon filter in
-- `src/lib/taxonomy.ts`, and duplicating that mapping here would be a second
-- source of truth.
-- ---------------------------------------------------------------------------
create table if not exists public.submissions (
  id               uuid primary key default gen_random_uuid(),
  observer_id      uuid not null references auth.users(id) on delete cascade,

  hex_id           text not null check (hex_id ~ '^[0-9a-f]{15}$'),
  latitude         double precision not null check (latitude  between -29.5 and -25.8),
  longitude        double precision not null check (longitude between -54.0 and -48.2),
  observed_on      date not null check (observed_on <= current_date),

  scientific_name  text not null check (length(btrim(scientific_name)) > 0),
  class_name       text,
  gbif_species_key integer,

  notes            text,
  status           public.submission_status not null default 'pending',

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on column public.submissions.latitude is
  'Constrained to the Santa Catarina bounding box used by the occurrence pipeline. A submission outside SC is out of scope for this tool, not merely unusual.';
comment on column public.submissions.status is
  'Derived by trigger from peer identifications — never set directly by a client. See public.refresh_submission_status.';

create index if not exists submissions_hex_idx      on public.submissions (hex_id);
create index if not exists submissions_status_idx   on public.submissions (status);
create index if not exists submissions_observer_idx on public.submissions (observer_id);


-- ---------------------------------------------------------------------------
-- identifications — the consensus mechanism. One vote per user per submission.
-- Voting on your own submission is blocked in the CHECK-equivalent policy and
-- again by trigger, because RLS alone would not stop a service-role write.
-- ---------------------------------------------------------------------------
create table if not exists public.identifications (
  id              uuid primary key default gen_random_uuid(),
  submission_id   uuid not null references public.submissions(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  verdict         public.identification_verdict not null,
  -- Only meaningful with verdict = 'disagree': the name this reviewer proposes
  -- instead. Null disagreement is allowed ("not this, unsure what").
  proposed_name   text,
  comment         text,
  created_at      timestamptz not null default now(),
  unique (submission_id, user_id)
);

create index if not exists identifications_submission_idx on public.identifications (submission_id);

create or replace function public.block_self_identification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.submissions s
             where s.id = new.submission_id and s.observer_id = new.user_id) then
    raise exception 'A contributor cannot confirm or dispute their own submission';
  end if;
  return new;
end $$;

drop trigger if exists identifications_no_self on public.identifications;
create trigger identifications_no_self
  before insert or update on public.identifications
  for each row execute function public.block_self_identification();


-- ---------------------------------------------------------------------------
-- Consensus rule.
--
-- CONSENSUS_THRESHOLD agreeing identifications from users other than the
-- observer flip a submission to `approved`; any disagreement holds it at
-- `disputed` until the disagreement is resolved. Two is the deliberate
-- starting value — it mirrors iNaturalist's "research grade" bar and is the
-- lowest number that still requires independent corroboration. It is a
-- product decision, not a scientific constant: raise it once submission
-- volume makes two confirmations cheap to obtain.
--
-- `withdrawn` is terminal and set by the observer, so the recompute leaves it
-- alone.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_submission_status(p_submission_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  consensus_threshold constant integer := 2;
  agrees    integer;
  disagrees integer;
  current   public.submission_status;
  next      public.submission_status;
begin
  select status into current from public.submissions where id = p_submission_id;
  if current is null or current = 'withdrawn' then
    return;
  end if;

  select
    count(*) filter (where verdict = 'agree'),
    count(*) filter (where verdict = 'disagree')
  into agrees, disagrees
  from public.identifications
  where submission_id = p_submission_id;

  next := case
    when disagrees > 0                  then 'disputed'::public.submission_status
    when agrees >= consensus_threshold  then 'approved'::public.submission_status
    else                                     'pending'::public.submission_status
  end;

  if next is distinct from current then
    -- Announce to guard_submission_status that this particular write is the
    -- trusted consensus recompute and not a client trying to set its own
    -- status. Transaction-local, so it cannot leak into another statement.
    perform set_config('biofrontier.consensus_update', 'on', true);
    update public.submissions
       set status = next, updated_at = now()
     where id = p_submission_id;
    perform set_config('biofrontier.consensus_update', 'off', true);

    insert into public.submission_audit (submission_id, actor_id, actor_role, from_status, to_status, reason)
    values (p_submission_id, null, null, current, next,
            format('consensus recompute: %s agree, %s disagree', agrees, disagrees));
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- submission_audit — role-aware trail, required by the decision record so that
-- adding an expert tier later does not leave earlier decisions unattributable.
-- A null actor means the transition was computed from consensus rather than
-- performed by a person.
-- ---------------------------------------------------------------------------
create table if not exists public.submission_audit (
  id            bigserial primary key,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  actor_id      uuid references auth.users(id) on delete set null,
  actor_role    public.user_role,
  from_status   public.submission_status,
  to_status     public.submission_status not null,
  reason        text,
  created_at    timestamptz not null default now()
);

create index if not exists submission_audit_submission_idx on public.submission_audit (submission_id, created_at);

create or replace function public.on_identification_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_submission_status(coalesce(new.submission_id, old.submission_id));
  return coalesce(new, old);
end $$;

drop trigger if exists identifications_refresh_status on public.identifications;
create trigger identifications_refresh_status
  after insert or update or delete on public.identifications
  for each row execute function public.on_identification_change();

-- Clients may not move `status` themselves. Everything except a withdrawal is
-- consensus-derived; letting an observer write the column directly would make
-- the review gate advisory.
create or replace function public.guard_submission_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('biofrontier.consensus_update', true), 'off') <> 'on' then
    if not (new.status = 'withdrawn' and auth.uid() = old.observer_id) then
      raise exception 'submission.status is derived from peer review and cannot be set directly';
    end if;
    insert into public.submission_audit (submission_id, actor_id, actor_role, from_status, to_status, reason)
    select old.id, auth.uid(), p.role, old.status, new.status, 'withdrawn by observer'
    from public.profiles p where p.id = auth.uid();
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists submissions_guard_status on public.submissions;
create trigger submissions_guard_status
  before update on public.submissions
  for each row execute function public.guard_submission_status();


-- ---------------------------------------------------------------------------
-- Row Level Security.
--
-- The public map is anonymous, so `anon` must read approved submissions — and
-- nothing else. Pending and disputed rows are visible only to signed-in users,
-- who are the ones being asked to review them.
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.submissions       enable row level security;
alter table public.identifications   enable row level security;
alter table public.submission_audit  enable row level security;

drop policy if exists profiles_read      on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_read       on public.profiles for select using (true);
create policy profiles_update_own on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

drop policy if exists submissions_read_approved on public.submissions;
drop policy if exists submissions_read_authed   on public.submissions;
drop policy if exists submissions_insert_own    on public.submissions;
drop policy if exists submissions_update_own    on public.submissions;
create policy submissions_read_approved on public.submissions for select to anon
  using (status = 'approved');
create policy submissions_read_authed   on public.submissions for select to authenticated
  using (true);
create policy submissions_insert_own    on public.submissions for insert to authenticated
  with check (auth.uid() = observer_id and status = 'pending');
-- An observer may correct their own record only while it is still pending;
-- once peers have acted on it, editing the name out from under their
-- identifications would silently invalidate the consensus.
create policy submissions_update_own    on public.submissions for update to authenticated
  using (auth.uid() = observer_id and status in ('pending', 'disputed'))
  with check (auth.uid() = observer_id);

drop policy if exists identifications_read       on public.identifications;
drop policy if exists identifications_insert_own on public.identifications;
drop policy if exists identifications_update_own on public.identifications;
drop policy if exists identifications_delete_own on public.identifications;
create policy identifications_read       on public.identifications for select using (true);
create policy identifications_insert_own on public.identifications for insert to authenticated
  with check (auth.uid() = user_id);
create policy identifications_update_own on public.identifications for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy identifications_delete_own on public.identifications for delete to authenticated
  using (auth.uid() = user_id);

-- The audit trail is readable but never client-writable: every row is written
-- by a security-definer trigger.
drop policy if exists submission_audit_read on public.submission_audit;
create policy submission_audit_read on public.submission_audit for select to authenticated using (true);


-- ---------------------------------------------------------------------------
-- Public read model for the GapMap marker layer: approved submissions only,
-- with their confirmation count, and no observer identity beyond a display
-- name. Phase 2 surfaces confirmation strength in the UI from this same view.
-- ---------------------------------------------------------------------------
create or replace view public.approved_submissions
with (security_invoker = true) as
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
