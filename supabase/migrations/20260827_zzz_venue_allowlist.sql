-- Fix for the audit's second Critical: busy-live was an open proxy to a paid API.
--
-- The function took venue_name and venue_address FROM THE CALLER and passed
-- them to BestTime with the private key. Two consequences: anybody could look
-- up any venue on earth on our account, and because the 20-minute cache was
-- keyed on a caller-supplied spot_id, every request with a fresh string was a
-- cache miss and therefore a paid call. The cache read as protection and was
-- none.
--
-- The venue list is not the caller's to choose. It lives here, server side,
-- and a spot_id that is not in it never reaches BestTime.

create table if not exists public.spot_venues (
  spot_id text primary key,
  venue_name text not null,
  venue_address text not null
);
alter table public.spot_venues enable row level security;
-- no policies: the edge function reads it with the service role, and no client
-- has any reason to enumerate our BestTime venue list

insert into public.spot_venues (spot_id, venue_name, venue_address) values
  ('admo', 'Madam''s Organ', '2461 18th St NW, Washington, DC 20009'),
  ('tryst', 'Tryst', '2459 18th St NW, Washington, DC 20009'),
  ('kogod', 'National Portrait Gallery', '800 G St NW, Washington, DC 20001'),
  ('ustreet', 'Ben''s Chili Bowl', '1213 U St NW, Washington, DC 20009'),
  ('fourteenth', 'Black Cat', '1811 14th St NW, Washington, DC 20009'),
  ('hstreet', 'Little Miss Whiskey''s Golden Dollar', '1104 H St NE, Washington, DC 20002'),
  ('navyyard', 'Bluejacket', '300 Tingey St SE, Washington, DC 20003'),
  ('colheights', 'The Wonderland Ballroom', '1101 Kenyon St NW, Washington, DC 20010'),
  ('ivycity', 'Echostage', '2135 Queens Chapel Rd NE, Washington, DC 20018'),
  ('gallery', 'Clyde''s of Gallery Place', '707 7th St NW, Washington, DC 20001'),
  ('mtpleasant', 'Marx Cafe Revolutionary Cuisine', '3203 Mt Pleasant St NW, Washington, DC 20010'),
  ('riave', 'metrobar', '640 Rhode Island Ave NE, Washington, DC 20002'),
  ('parkview', 'Hook Hall', '3400 Georgia Ave NW, Washington, DC 20010'),
  ('georgetown', 'Call Your Mother Deli - Georgetown', '3428 O St NW, Washington, DC 20007'),
  ('dupont', 'Kramers', '1517 Connecticut Ave NW, Washington, DC 20036'),
  ('unionmarket', 'Union Market', '1309 5th St NE, Washington, DC 20002'),
  ('barracks', 'The Roost', '1401 Pennsylvania Ave SE, Washington, DC 20003'),
  ('petworth', 'Timber Pizza Co. Petworth', '809 Upshur St NW, Washington, DC 20011'),
  ('farragut', 'The Square', '1850 K St NW, Washington, DC 20006'),
  ('den', 'Politics and Prose Bookstore', '5015 Connecticut Ave NW, Washington, DC 20008'),
  ('bigbear', 'Big Bear Cafe', '1700 1st St NW, Washington, DC 20001'),
  ('lacolombe', 'La Colombe Coffee Workshop', '924 Blagden Alley NW, Washington, DC 20001'),
  ('peregrine', 'Peregrine Espresso', '660 Pennsylvania Ave SE, Washington, DC 20003'),
  ('mlk', 'Martin Luther King Jr. Memorial Library', '901 G St NW, Washington, DC 20001'),
  ('wharf', 'Kirwan’s on the Wharf', '749 Wharf St SW, Washington, DC 20024'),
  ('latenight18', 'the DINER', '2453 18th St NW, Washington, DC 20009'),
  ('surfside', 'Surfside Taco Stand', '1800 N St NW, Washington, DC 20036'),
  ('clubrow', 'Decades DC', '1219 Connecticut Ave NW, Washington, DC 20036'),
  ('dc9', 'DC9 Nightclub', '1940 9th St NW, Washington, DC 20001'),
  ('shaw2', 'Calico', '50 Blagden Alley NW, Washington, DC 20001'),
  ('navyyard2', 'Dacha Beer Garden (Navy Yard)', '79 Potomac Ave SE, Washington, DC 20003'),
  ('fourteenth2', 'Service Bar DC', '926 U St NW, Washington, DC 20001'),
  ('gallery2', 'Penn Social', '801 E St NW, Washington, DC 20004'),
  ('hstreet2', 'Maketto', '1351 H St NE, Washington, DC 20002'),
  ('georgetown2', 'The Tombs', '1226 36th St NW, Washington, DC 20007'),
  ('dupont2', 'Duke''s Grocery', '1513 17th St NW, Washington, DC 20036'),
  ('wharf2', 'Pearl Street Warehouse', '33 Pearl St SW, Washington, DC 20024')
on conflict (spot_id) do update
  set venue_name = excluded.venue_name, venue_address = excluded.venue_address;

-- A hard ceiling on spend, independent of how the caller behaves. Even with
-- the allowlist, 37 venues refreshed every 20 minutes is ~111 paid calls an
-- hour; this caps it and degrades to stale cache instead of to a bill.
create table if not exists public.api_budget (
  name text primary key,
  hour timestamptz not null,
  used int not null default 0
);
alter table public.api_budget enable row level security;

create or replace function public.take_api_credit(p_name text, p_max int)
returns boolean language plpgsql as $fn$
declare h timestamptz := date_trunc('hour', now()); cur int;
begin
  insert into public.api_budget (name, hour, used) values (p_name, h, 1)
  on conflict (name) do update
    set hour = h,
        used = case when public.api_budget.hour = h then public.api_budget.used + 1 else 1 end
  returning used into cur;
  return cur <= p_max;
end $fn$;

revoke all on function public.take_api_credit(text, int) from public, anon, authenticated;
