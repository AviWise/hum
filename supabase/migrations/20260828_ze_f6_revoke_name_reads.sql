-- F6, part two: stop publishing full_name.
--
-- ORDERING: 'ze' so it sorts after 'zc', which stopped writing the column.
--
-- SPLIT FROM zc DELIBERATELY. Revoking the column privilege makes PostgREST
-- refuse the whole request for any client that names full_name in a select, and
-- the bundle live on GitHub Pages right now names it in four components. Applied
-- together, this would have 403'd profile reads on the live site between the
-- migration and the deploy. zc is safe to apply immediately because it only
-- stops the column being filled in; this half waits until the new bundle is up.

-- 3. Stop publishing it. A table-level SELECT grant covers every column, and a
--    single column cannot be revoked out of one — the grant has to come off and
--    go back on per column. Every column except full_name is re-granted, so
--    nothing else changes shape.
revoke select on public.profiles from anon, authenticated;
grant select (id, username, created_at, kind, school_domain, claimed_at, bio,
              suspended_until, suspended_reason)
  on public.profiles to anon, authenticated;

revoke update on public.profiles from anon, authenticated;
grant update (username, bio, kind, school_domain, claimed_at,
              suspended_until, suspended_reason)
  on public.profiles to authenticated;
-- kind, school_domain and claimed_at stay grantable on purpose: profiles_guard
-- reverts them, and the org-rls-attack suite asserts that it does. Taking the
-- grant away would swap a tested silent revert for an untested permission error.

revoke insert on public.profiles from anon, authenticated;
grant insert (id, username, created_at, kind, school_domain, claimed_at, bio,
              suspended_until, suspended_reason)
  on public.profiles to anon, authenticated;
-- There is no INSERT policy on profiles, so this grant is unreachable either
-- way; it is re-granted only so that this migration changes one thing.
