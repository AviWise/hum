-- out. — real posting on a complete schema.
--
-- Everything past `posts` is written from the first post but read by nothing
-- yet: impressions and contest windows cannot be reconstructed after the fact,
-- so they start logging now even though the contest layer is gated on the
-- retention question ("will anyone post a second time?").

-- ---------------------------------------------------------------- posts ----
-- Align names with the schema of record. user_id -> author_id, photo_url ->
-- photo_path, plus the sizes the render pipeline actually needs.
alter table public.posts rename column user_id to author_id;
alter table public.posts rename column photo_url to photo_path;

alter table public.posts add column if not exists event_id uuid;
alter table public.posts add column if not exists thumb_path text;   -- 96px, markers
alter table public.posts add column if not exists mid_path text;     -- 480px, feed
alter table public.posts add column if not exists is_demo boolean not null default false;
alter table public.posts add column if not exists removed_at timestamptz;

-- `hidden` was the old moderation flag; removed_at is the schema of record.
update public.posts set removed_at = now() where hidden and removed_at is null;

create index if not exists posts_live_idx on public.posts (expires_at desc) where removed_at is null;
create index if not exists posts_author_idx on public.posts (author_id, created_at desc);
create index if not exists posts_spot_idx on public.posts (spot_id, created_at desc);

-- ---------------------------------------------------------- impressions ----
-- Written on every render of a photo to a person. Scoring is likes/impressions,
-- never raw likes, and equal-exposure quotas depend on this table existing from
-- day one. Nothing reads it yet. It cannot be backfilled.
create table if not exists public.impressions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  surface text not null check (surface in ('city', 'school')),
  shown_at timestamptz not null default now()
);
create index if not exists impressions_post_idx on public.impressions (post_id);
create index if not exists impressions_viewer_idx on public.impressions (viewer_id, shown_at);

-- ---------------------------------------------------------------- likes ----
-- One like per person per photo, whatever surface it was cast on; `surface`
-- records where the vote happened because the school crown and the city crown
-- are decided by different audiences.
alter table public.likes add column if not exists surface text not null default 'city'
  check (surface in ('city', 'school'));

-- ------------------------------------------------------------- contests ----
-- First-class object, not a query: a spot-week produces TWO rows, one per
-- audience, because the two crowns are counted from different vote pools.
create table if not exists public.contests (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('spot', 'event')),
  scope_id text not null,
  audience text not null check (audience in ('city', 'school')),
  school_domain text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  locked_at timestamptz,
  winner_post_id uuid references public.posts(id) on delete set null,
  entry_count integer not null default 0,
  constraint school_audience_has_domain check (audience <> 'school' or school_domain is not null),
  constraint contest_window check (ends_at > starts_at)
);
create unique index if not exists contests_window_idx
  on public.contests (scope_type, scope_id, audience, coalesce(school_domain, ''), starts_at);

-- ------------------------------------------------------------- trophies ----
-- Separate from posts on purpose: the photo leaves circulation when it expires,
-- the record of having won does not.
create table if not exists public.trophies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contest_id uuid not null references public.contests(id) on delete cascade,
  post_id uuid references public.posts(id) on delete set null,
  awarded_at timestamptz not null default now(),
  unique (contest_id, user_id)
);
create index if not exists trophies_user_idx on public.trophies (user_id, awarded_at desc);

-- --------------------------------------------------- school_verifications --
create table if not exists public.school_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  domain text not null,
  verified_at timestamptz not null default now(),
  expires_at timestamptz
);
create index if not exists school_ver_domain_idx on public.school_verifications (domain);

-- ---------------------------------------------------------------- reports --
alter table public.reports add column if not exists resolved_at timestamptz;
