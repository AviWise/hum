-- The suspension check ran after dm_guard, and triggers fire in name order —
-- so a suspended account writing into a still-pending thread was refused with
-- 'wait until they answer' instead of 'your account is suspended'. The refusal
-- was correct and the reason was wrong, which is the kind of error that sends
-- someone to support asking the wrong question. It also meant the test could
-- not tell whether suspension worked here at all.
--
-- Renamed to sort BEFORE dm_guard: whether you are allowed to speak at all is
-- the first question, not the last.
drop trigger if exists dm_zz_suspension on public.dm_messages;
drop trigger if exists dm_aa_suspension on public.dm_messages;
create trigger dm_aa_suspension before insert on public.dm_messages
  for each row execute function public.dm_suspension_guard();

drop trigger if exists posts_zz_suspension on public.posts;
drop trigger if exists posts_aa_suspension on public.posts;
create trigger posts_aa_suspension before insert on public.posts
  for each row execute function public.posts_suspension_guard();
