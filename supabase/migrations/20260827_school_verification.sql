-- out. — university groups, part two: prove you go there.
--
-- This is what turns the campus tier on. Until now a post marked audience
-- 'school' was readable by nobody but its author, because nothing could tell a
-- student from anyone else. Now a verified student at the author's school can
-- read it, and still nobody else.
--
-- The client never writes a verification. It asks the school-verify function,
-- which owns the whole exchange; school_challenges has no RLS policies at all,
-- so only the service role can see or touch a pending code.

-- ------------------------------------------------------------- schools ----
-- One list, read by the app and by the function, so adding a school is a row
-- rather than a deploy — and so the two can never drift apart.
create table if not exists public.schools (
  domain text primary key,
  name text not null,
  sort int not null default 100
);
alter table public.schools enable row level security;
drop policy if exists "schools list: public read" on public.schools;
create policy "schools list: public read" on public.schools for select using (true);

insert into public.schools (domain, name, sort) values
  ('gwu.edu', 'George Washington', 10),
  ('georgetown.edu', 'Georgetown', 20),
  ('howard.edu', 'Howard', 30),
  ('american.edu', 'American', 40),
  ('umd.edu', 'Maryland', 50),
  ('cua.edu', 'Catholic', 60),
  ('gallaudet.edu', 'Gallaudet', 70),
  ('trinitydc.edu', 'Trinity Washington', 80),
  ('udc.edu', 'UDC', 90),
  ('marymount.edu', 'Marymount', 100),
  ('gmu.edu', 'George Mason', 110)
on conflict (domain) do update set name = excluded.name, sort = excluded.sort;

-- -------------------------------------------------- school_verifications ----
-- The address itself is never stored — only a hash. We need to answer "has
-- this mailbox already verified somebody?" and nothing else, and an inbox full
-- of student addresses is a liability we have no use for.
alter table public.school_verifications add column if not exists email_hash text;
create unique index if not exists school_ver_one_mailbox
  on public.school_verifications (email_hash) where email_hash is not null;

-- ---------------------------------------------------- school_challenges ----
create table if not exists public.school_challenges (
  user_id uuid primary key references auth.users(id) on delete cascade,
  domain text not null references public.schools(domain),
  email_hash text not null,
  code_hash text not null,
  sent_at timestamptz not null default now(),
  expires_at timestamptz not null,
  attempts int not null default 0,
  sends_today int not null default 1,
  day date not null default current_date
);
alter table public.school_challenges enable row level security;
-- deliberately no policies: a pending code is not the client's business, not
-- even its owner's. Only the service role reads or writes this table.

-- ---------------------------------------------------------- the payoff ----
create or replace function public.verified_at(dom text) returns boolean
language sql stable security definer set search_path = public, extensions as $fn$
  select exists (
    select 1 from public.school_verifications v
    where v.user_id = auth.uid()
      and v.domain = dom
      and (v.expires_at is null or v.expires_at > now())
  )
$fn$;

-- A campus post reaches verified students of the AUTHOR's school. Not the
-- reader's own school, not any school — the one the post belongs to.
drop policy if exists "posts: campus posts reach verified classmates" on public.posts;
create policy "posts: campus posts reach verified classmates" on public.posts
  for select to authenticated using (
    removed_at is null
    and audience = 'school'
    and public.verified_at((select p.school_domain from public.profiles p where p.id = posts.author_id))
  );
