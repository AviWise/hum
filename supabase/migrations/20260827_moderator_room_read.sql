-- Burying a room message made it fail the read policy in the same statement:
-- "read what's live" requires removed_at is null, and Postgres applies SELECT
-- policies to the returned row of an UPDATE. So the bury succeeded logically
-- and was rejected as "new row violates row-level security policy" — an error
-- about the read, phrased like an error about the write.
--
-- A moderator can see room messages whatever their state. Rooms are public
-- speech, so this is a far smaller grant than the DM rule, which stays scoped
-- to threads with an open report.
drop policy if exists "room: moderators see all states" on public.room_messages;
create policy "room: moderators see all states" on public.room_messages
  for select to authenticated using (public.is_admin());
