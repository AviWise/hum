-- F1: public post history was permanent, per-person, and needed no account.
--
-- ORDERING: 'za' so it sorts after 20260828_reserved_at_every_door.sql.
--
-- 20260826_durable_history.sql dropped the expiry bound from the read policy on
-- purpose, so profile grids would work. The cost was the finding: any logged-out
-- stranger could enumerate where a named student had been, with timestamps,
-- indefinitely, and ProfilePage rendered it as a map of their haunts.
--
-- Avi's rule (2026-08-28): people should not be able to see exactly where other
-- people are.
--
-- Note what is NOT the fix. "Stop them querying it per person" cannot be
-- enforced here: RLS is row-level, so it cannot tell a query filtered by
-- username from one filtered by spot, and anyone holding the publishable key
-- can page the table either way and sort it themselves afterwards. The only
-- enforceable version of the rule is to bound what is readable at all.
--
--   stays public   LIVE posts. Saying "I'm at Dupont" is an explicit act with
--                  an expiry on it, and it is the whole product.
--   stops being    the durable per-person archive.
--   public
--   keeps it       the author, unbounded, through "posts: authors read their
--                  own", which already exists and is deliberately not touched.
--   exempt         seeded demo content. Those are fictional people, and it is
--                  what keeps the city looking inhabited for the first students.
--
-- expires_at stops being a thing that "reads like a privacy control and is not
-- one". It now governs both the map and the record.

drop policy if exists "posts: read the public record" on public.posts;
drop policy if exists "posts: read the record" on public.posts;
create policy "posts: read the public record" on public.posts
  for select using (
    removed_at is null
    and audience = 'city'
    and (is_demo or expires_at > now())
  );

-- The campus tier gets the same bound. A verified classmate enumerating a
-- classmate's movements is the same harm with a smaller gallery, and leaving it
-- unbounded would have made the school audience the softer way in.
drop policy if exists "posts: campus posts reach verified classmates" on public.posts;
create policy "posts: campus posts reach verified classmates" on public.posts
  for select to authenticated using (
    removed_at is null
    and audience = 'school'
    and (is_demo or expires_at > now())
    and public.verified_at((select o.school_domain from public.orgs o where o.id = posts.org_id))
  );
