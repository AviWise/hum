-- "Official American University" walked past the guard: the check compared the
-- whole normalised name against a reserved token, and
-- "officialamericanuniversity" equals nothing in the list.
--
-- Containment is the fix, but only for tokens long enough to be unambiguous.
-- Matching "au" as a substring would refuse Auburn Society, Beauty Club and
-- Restaurant Week — so short tokens stay exact and long distinctive ones match
-- anywhere in the name.
alter table public.reserved_handles add column if not exists mode text not null default 'exact';
alter table public.reserved_handles drop constraint if exists reserved_mode;
alter table public.reserved_handles add constraint reserved_mode check (mode in ('exact', 'contains'));

-- anything institutional and 8+ characters is safe to catch anywhere
update public.reserved_handles set mode = 'contains'
  where char_length(token) >= 8 or token in ('official', 'moderator');

insert into public.reserved_handles (token, reason, mode) values
  ('americanuniversity', 'institution', 'contains'),
  ('georgetownuniversity', 'institution', 'contains'),
  ('georgewashingtonuniversity', 'institution', 'contains'),
  ('howarduniversity', 'institution', 'contains'),
  ('universityofmaryland', 'institution', 'contains'),
  ('catholicuniversity', 'institution', 'contains'),
  ('gallaudetuniversity', 'institution', 'contains'),
  ('marymountuniversity', 'institution', 'contains'),
  ('georgemasonuniversity', 'institution', 'contains'),
  ('trinitywashington', 'institution', 'contains'),
  ('official', 'impersonation', 'contains'),
  ('administration', 'impersonation', 'contains'),
  ('moderator', 'impersonation', 'contains')
on conflict (token) do update set mode = excluded.mode, reason = excluded.reason;

create or replace function public.is_reserved(s text) returns boolean
language sql stable set search_path = public, extensions as $fn$
  select exists (
    select 1 from public.reserved_handles r
    where (r.mode = 'exact' and r.token = public.name_token(s))
       or (r.mode = 'contains' and public.name_token(s) like '%' || r.token || '%')
  )
$fn$;
