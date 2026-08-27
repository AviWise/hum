-- out. — make the "publishable key is safe because RLS carries the permissions"
-- claim in supa.js actually true.
--
-- Rule of thumb encoded below: the client may read what the app shows, may
-- write only rows that are its own, and may never write anything that decides
-- an outcome (contests, trophies, verifications are server-job territory).

-- ---------------------------------------------------------------- posts ----
alter table public.posts enable row level security;

drop policy if exists "read posts" on public.posts;
drop policy if exists "read live posts" on public.posts;
drop policy if exists "posts: read live" on public.posts;
-- Live only. Expiry is enforced by the policy itself, so no cleanup job can
-- forget and no client query can opt out of it.
create policy "posts: read live" on public.posts
  for select using (removed_at is null and expires_at > now());

drop policy if exists "posts: authors read their own history" on public.posts;
-- An author keeps sight of their own past posts (profile history); everyone
-- else only ever sees what is live.
create policy "posts: authors read their own history" on public.posts
  for select to authenticated using (removed_at is null and author_id = auth.uid());

drop policy if exists "signed-in people post" on public.posts;
drop policy if exists "posts: insert as self" on public.posts;
create policy "posts: insert as self" on public.posts
  for insert to authenticated with check (author_id = auth.uid());

drop policy if exists "posts: author edits own" on public.posts;
create policy "posts: author edits own" on public.posts
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

-- ---------------------------------------------------------- impressions ----
alter table public.impressions enable row level security;
drop policy if exists "impressions: insert own" on public.impressions;
create policy "impressions: insert own" on public.impressions
  for insert to authenticated with check (viewer_id = auth.uid());
-- deliberately no select policy: the client writes impressions and never reads
-- them. Scoring runs server-side with the service role.

-- ---------------------------------------------------------------- likes ----
alter table public.likes enable row level security;
drop policy if exists "sign in to like" on public.likes;
drop policy if exists "likes: insert own" on public.likes;
create policy "likes: insert own" on public.likes
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "unlike your own" on public.likes;
drop policy if exists "likes: remove own" on public.likes;
create policy "likes: remove own" on public.likes
  for delete to authenticated using (user_id = auth.uid());

-- NOTE (deviation, reported): the brief specifies likes as insert-only with no
-- client reads, on the assumption that no like UI exists yet. It does — likes
-- and counts shipped earlier and are in use on the spot sheet. Reads stay open
-- (a like is a public social signal) rather than silently breaking a shipped
-- feature. Nothing here lets anyone forge a like as someone else.
drop policy if exists "likes are public" on public.likes;
drop policy if exists "likes: counts are public" on public.likes;
create policy "likes: counts are public" on public.likes for select using (true);

-- ------------------------------------------------------------- comments ----
alter table public.comments enable row level security;
drop policy if exists "sign in to comment" on public.comments;
drop policy if exists "comments: insert own" on public.comments;
create policy "comments: insert own" on public.comments
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "read comments" on public.comments;
drop policy if exists "comments: read visible" on public.comments;
create policy "comments: read visible" on public.comments
  for select using (not hidden);

-- -------------------------------------------------------------- reports ----
alter table public.reports enable row level security;
drop policy if exists "signed-in people report" on public.reports;
drop policy if exists "reports: file as self" on public.reports;
create policy "reports: file as self" on public.reports
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "reports: read own" on public.reports;
create policy "reports: read own" on public.reports
  for select to authenticated using (user_id = auth.uid());

-- ------------------------------------------- contests, trophies, schools ----
-- Read-only from the client. Every write here decides an outcome, so it belongs
-- to the server job that holds the service role.
alter table public.contests enable row level security;
drop policy if exists "contests: public read" on public.contests;
create policy "contests: public read" on public.contests for select using (true);

alter table public.trophies enable row level security;
drop policy if exists "trophies: public read" on public.trophies;
create policy "trophies: public read" on public.trophies for select using (true);

alter table public.school_verifications enable row level security;
drop policy if exists "schools: owner reads own" on public.school_verifications;
create policy "schools: owner reads own" on public.school_verifications
  for select to authenticated using (user_id = auth.uid());
-- no insert/update/delete policy at all: the client cannot verify itself.

-- ------------------------------------------------------------- profiles ----
alter table public.profiles enable row level security;
drop policy if exists "profiles are public" on public.profiles;
drop policy if exists "profiles: public read" on public.profiles;
create policy "profiles: public read" on public.profiles for select using (true);
drop policy if exists "profiles: owner edits own" on public.profiles;
create policy "profiles: owner edits own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
