-- Two bugs the membership tests caught.
--
-- 1. The org byline never stuck. posts_audience_guard set username to the org
--    handle, but triggers fire in NAME order and posts_guard sorts after it —
--    so posts_guard's "username := the author's profile" overwrote it every
--    time, and org posts went out under the member's personal handle. Renaming
--    the trigger so it runs last is the fix; it also means author_id is
--    already populated by the time it runs.
--
-- 2. The roster policy recursed. "you may read org_members if you appear in
--    org_members" is a policy that queries its own table, which Postgres
--    rejects at runtime rather than answering. Members got an error, not rows
--    — and outsiders got the same error, which their tests read as "correctly
--    saw nothing". A SECURITY DEFINER helper reads the table without
--    re-entering the policy.

drop trigger if exists posts_audience_guard on public.posts;
drop function if exists public.posts_audience_guard();

create or replace function public.posts_org_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  poster uuid := coalesce(auth.uid(), new.author_id);
  org_handle text;
begin
  if new.org_id is not null then
    if poster is null or not exists (
      select 1 from public.org_members m where m.org_id = new.org_id and m.user_id = poster
    ) then
      raise exception 'you are not in that group';
    end if;
    select handle into org_handle from public.orgs where id = new.org_id;
    new.username := org_handle;
  else
    new.audience := 'city';
  end if;

  if new.audience not in ('city', 'school') then
    new.audience := 'city';
  end if;
  return new;
end $fn$;

-- named to sort after posts_guard, which is what makes the byline stick
drop trigger if exists posts_org_guard on public.posts;
create trigger posts_org_guard before insert or update on public.posts
  for each row execute function public.posts_org_guard();

drop policy if exists "org_members: members see the roster" on public.org_members;
create policy "org_members: members see the roster" on public.org_members
  for select to authenticated using (public.is_org_member(org_id));
