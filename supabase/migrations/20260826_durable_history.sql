-- Bring back the durable record: a post leaves the MAP when it expires, but a
-- spot keeps the memory of who's been there and a profile keeps its archive.
--
-- Expiry stays a product rule enforced where it matters — the map query filters
-- to live posts, so nothing stale is ever presented as current. What changes is
-- only whether history can be READ.
drop policy if exists "posts: read live" on public.posts;
drop policy if exists "posts: authors read their own history" on public.posts;

create policy "posts: read the record" on public.posts
  for select using (removed_at is null);
