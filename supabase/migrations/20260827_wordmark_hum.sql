-- The product is called hum. now, not out.
--
-- ORDERING: must sort after 20260827_schools_unownable.sql (creates
-- reserved_handles) and 20260827_reserved_contains.sql (adds `mode`) — a w
-- sorts after both. The older migrations still say "out"; applied migrations
-- are history and do not get rewritten.
--
-- Two things the rename has to do in the database rather than in the source:
-- reserve the new brand before somebody else takes it, and move the demo
-- accounts, whose handles are rendered to users as @out.demo.* today.

-- Reserve the new name at both doors, exactly as the old one was. The old
-- tokens stay reserved on purpose: a handle like @outofficial pointing at a
-- product that no longer exists is still a good vehicle for impersonating us
-- to anybody who remembers the first name.
insert into public.reserved_handles (token, reason, mode) values
  ('hum',         'the product',            'exact'),
  ('humofficial', 'the product',            'exact'),
  ('humapp',      'the product',            'exact'),
  ('humdc',       'the product',            'exact'),
  ('humteam',     'the product',            'exact'),
  ('humsupport',  'impersonating support',  'exact'),
  ('humadmin',    'impersonating staff',    'exact')
on conflict (token) do nothing;

-- The demo accounts. Their usernames are displayed, so leaving them as
-- @out.demo.* would put the old name on screen next to the new wordmark.
update public.profiles
   set username = 'hum.' || substring(username from 5)
 where username like 'out.%';

-- posts carry a denormalised username for the byline
update public.posts
   set username = 'hum.' || substring(username from 5)
 where username like 'out.%';

update public.room_messages
   set username = 'hum.' || substring(username from 5)
 where username like 'out.%';

update public.group_messages
   set username = 'hum.' || substring(username from 5)
 where username like 'out.%';
