-- A shared cache for the WMATA-keyed functions.
--
-- ORDERING: 'zh', last of the 08-28 set.
--
-- metro-alerts, train-times and train-trip all hold the WMATA key server-side
-- and all three answered any unauthenticated caller, with no cache that survived
-- an isolate and no ceiling. train-trip was the worst of them: every request
-- fetched the full GTFS-RT TripUpdates protobuf AND the incidents feed, so one
-- caller in a loop meant two upstream calls each, one of them a large binary.
--
-- The precedent is F9's, and so is the reasoning: the fix is NOT authentication.
-- Signed-out visitors are meant to see when the next train is, and requiring an
-- account to read the Metro board would break the product to fix an abuse
-- problem. What goes is the abuse primitive — an unbounded, uncached, unvalidated
-- path to somebody else's API on our key.
--
-- Deliberately NOT added to retention_policy. purge_expired raises if a policy
-- row has no matching predicate in its source, so a row here without a matching
-- edit there would break the hourly purge for every table. The cache prunes
-- itself on write instead, which is where the knowledge of its own TTL already
-- lives.
create table if not exists public.api_cache (
  name text not null,
  key text not null,
  body jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (name, key)
);
alter table public.api_cache enable row level security;
-- no policies: service-role and the owner only, like live_cache

create index if not exists api_cache_fetched_at on public.api_cache (fetched_at);
