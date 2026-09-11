-- =============================================================================
-- 0005_question_bank_sharing.sql
-- Phase 3B — Question Bank sharing.
--
-- Scope:
--   - owner-approved, directional sharing between authenticated teachers
--   - read-only access for approved recipients
--   - revocation without deleting the audit row
--   - invitation token hash stored outside the exposed public schema
--   - RLS enforcement for question_banks, questions, question_options
--   - security-definer RPCs only for share creation/token resolution
--
-- Important:
--   The raw invitation token is never stored in PostgreSQL.
--   The application generates the raw token and passes only its SHA-256 hash
--   to the create RPC.
-- =============================================================================

create extension if not exists pgcrypto
  with schema extensions;

create schema if not exists private;

create table public.question_bank_shares (
  id uuid primary key default gen_random_uuid(),
  question_bank_id uuid not null
    references public.question_banks (id) on delete cascade,
  owner_id uuid not null
    references public.profiles (id) on delete cascade,
  shared_with_user_id uuid not null
    references public.profiles (id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (
    (status = 'active' and revoked_at is null)
    or
    (status = 'revoked' and revoked_at is not null)
  )
);

create index idx_question_bank_shares_owner_id
  on public.question_bank_shares (owner_id);

create index idx_question_bank_shares_recipient_id
  on public.question_bank_shares (shared_with_user_id);

create index idx_question_bank_shares_bank_id
  on public.question_bank_shares (question_bank_id);

create unique index uq_question_bank_shares_active_recipient
  on public.question_bank_shares (question_bank_id, shared_with_user_id)
  where status = 'active';

create table private.question_bank_share_tokens (
  share_id uuid primary key
    references public.question_bank_shares (id) on delete cascade,
  token_hash text not null unique
    check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index idx_question_bank_share_tokens_token_hash
  on private.question_bank_share_tokens (token_hash);

comment on table public.question_bank_shares is
  'Directional owner-approved Question Bank sharing. Recipients have read-only access.';

comment on table private.question_bank_share_tokens is
  'Private SHA-256 hashes for Question Bank invitation tokens. Raw tokens are never stored.';

create or replace function public.assert_question_bank_share_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.question_banks qb
    where qb.id = new.question_bank_id
      and qb.teacher_id = new.owner_id
  ) then
    raise exception 'share owner must own the question bank';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = new.shared_with_user_id
  ) then
    raise exception 'share recipient must reference an existing profile';
  end if;

  if new.owner_id = new.shared_with_user_id then
    raise exception 'question bank cannot be shared with its owner';
  end if;

  if tg_op = 'UPDATE' then
    if new.question_bank_id <> old.question_bank_id
       or new.owner_id <> old.owner_id
       or new.shared_with_user_id <> old.shared_with_user_id then
      raise exception 'share owner, recipient, and question bank are immutable';
    end if;

    if old.status = 'revoked' and new.status <> 'revoked' then
      raise exception 'revoked share cannot be reactivated';
    end if;
  end if;

  if new.status = 'active' and new.revoked_at is not null then
    raise exception 'active share cannot have revoked_at';
  end if;

  if new.status = 'revoked' and new.revoked_at is null then
    new.revoked_at := now();
  end if;

  if new.status = 'active' and new.revoked_at is null then
    new.revoked_at := null;
  end if;

  return new;
end;
$$;

create trigger trg_question_bank_shares_integrity
  before insert or update on public.question_bank_shares
  for each row
  execute function public.assert_question_bank_share_integrity();

-- ---------------------------------------------------------------------------
-- RLS: question_bank_shares
-- ---------------------------------------------------------------------------

alter table public.question_bank_shares enable row level security;

revoke all on table public.question_bank_shares
  from anon, authenticated;

grant select, insert, update
  on table public.question_bank_shares
  to authenticated;

create policy question_bank_shares_owner_select
  on public.question_bank_shares
  for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy question_bank_shares_recipient_select
  on public.question_bank_shares
  for select
  to authenticated
  using (
    shared_with_user_id = (select auth.uid())
    and status = 'active'
  );

create policy question_bank_shares_owner_insert
  on public.question_bank_shares
  for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
  );

create policy question_bank_shares_owner_update
  on public.question_bank_shares
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Extend Question Bank read policies.
-- Owners retain access. Approved active recipients gain SELECT only.
-- ---------------------------------------------------------------------------

create policy question_banks_select_shared
  on public.question_banks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.question_bank_shares qbs
      where qbs.question_bank_id = question_banks.id
        and qbs.shared_with_user_id = (select auth.uid())
        and qbs.status = 'active'
    )
  );

create policy questions_select_shared_bank
  on public.questions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.question_bank_shares qbs
      where qbs.question_bank_id = questions.question_bank_id
        and qbs.shared_with_user_id = (select auth.uid())
        and qbs.status = 'active'
    )
  );

create policy question_options_select_shared_bank
  on public.question_options
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.questions q
      join public.question_bank_shares qbs
        on qbs.question_bank_id = q.question_bank_id
      where q.id = question_options.question_id
        and qbs.shared_with_user_id = (select auth.uid())
        and qbs.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- Share creation RPC.
--
-- The application generates a cryptographically random raw token and sends
-- only its SHA-256 hex digest here. The function verifies that the caller owns
-- the bank and cannot create a share for themselves.
-- ---------------------------------------------------------------------------

create or replace function public.create_question_bank_share(
  p_question_bank_id uuid,
  p_shared_with_user_id uuid,
  p_token_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_share_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
  end if;

  if p_token_hash is null
     or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid share token hash';
  end if;

  if p_shared_with_user_id = (select auth.uid()) then
    raise exception 'question bank cannot be shared with its owner';
  end if;

  if not exists (
    select 1
    from public.question_banks qb
    where qb.id = p_question_bank_id
      and qb.teacher_id = (select auth.uid())
  ) then
    raise exception 'question bank is not owned by the current teacher';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_shared_with_user_id
  ) then
    raise exception 'recipient teacher does not exist';
  end if;

  insert into public.question_bank_shares (
    question_bank_id,
    owner_id,
    shared_with_user_id
  )
  values (
    p_question_bank_id,
    (select auth.uid()),
    p_shared_with_user_id
  )
  returning id into v_share_id;

  insert into private.question_bank_share_tokens (
    share_id,
    token_hash
  )
  values (
    v_share_id,
    p_token_hash
  );

  return v_share_id;
exception
  when unique_violation then
    raise exception 'an active share already exists for this teacher';
end;
$$;

revoke execute on function public.create_question_bank_share(uuid, uuid, text)
  from public, anon;

grant execute on function public.create_question_bank_share(uuid, uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Token resolution RPC.
--
-- This function is intentionally narrow:
--   - caller must be authenticated
--   - token must match a stored hash
--   - share must be active
--   - caller must be the specifically approved recipient
--
-- It returns only the share/bank identifiers needed by the application.
-- ---------------------------------------------------------------------------

create or replace function public.resolve_question_bank_share(
  p_token_hash text
)
returns table (
  share_id uuid,
  question_bank_id uuid,
  owner_id uuid
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    qbs.id as share_id,
    qbs.question_bank_id,
    qbs.owner_id
  from public.question_bank_shares qbs
  join private.question_bank_share_tokens qbst
    on qbst.share_id = qbs.id
  where p_token_hash ~ '^[0-9a-f]{64}$'
    and qbst.token_hash = p_token_hash
    and qbs.status = 'active'
    and qbs.shared_with_user_id = (select auth.uid())
$$;

revoke execute on function public.resolve_question_bank_share(text)
  from public, anon;

grant execute on function public.resolve_question_bank_share(text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Token deletion on revoke is deliberately NOT automatic.
-- Keeping the token hash preserves an audit trail while the share status
-- prevents reuse. A future re-share gets a new share row and new token.
-- ---------------------------------------------------------------------------

comment on function public.create_question_bank_share(uuid, uuid, text) is
  'Creates an owner-approved directional Question Bank share and stores only a SHA-256 token hash.';

comment on function public.resolve_question_bank_share(text) is
  'Resolves an active Question Bank share only for the specifically approved authenticated recipient.';
