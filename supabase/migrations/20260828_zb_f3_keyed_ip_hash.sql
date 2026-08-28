-- F3: ip_hash was an IP address in a thin disguise.
--
-- ORDERING: 'zb' so it sorts after 'za'.
--
-- req_ip_hash() returned encode(digest(ip || '', 'sha256'), 'hex') — unsalted,
-- with an empty concatenation sitting exactly where a salt was once intended.
-- Demonstrated on 2026-08-28 rather than argued: called over the live REST API
-- from this laptop it returned 441d45b7…, and sha256 of this machine's public
-- IP is 441d45b7…. One guess, no rainbow table, no 2^32 sweep.
--
-- Same fix as F4: key it. The pepper cannot be a per-row salt, because the
-- point of the hash is that the same IP matches itself across rows.
--
-- WHY NOT A SERVER SETTING, which is what SECURITY.md prescribed. A GUC set with
-- ALTER DATABASE only reaches sessions opened afterwards, and PostgREST holds
-- its connections open for a long time. Between applying this and those
-- connections recycling, req_ip_hash would fail closed and every post and room
-- message on the live site would be refused — an outage of unknown length, days
-- before 50 students arrive. Supabase Vault has neither problem: it is read at
-- call time, so the swap is atomic with this migration, and the encryption key
-- lives outside the database, which is closer to F3's "the pepper cannot live in
-- the same database as the hashes" than a GUC in the catalog ever was.
--
-- Existing rows are not migrated, because you cannot un-hash to re-hash. There
-- is nothing to migrate in any case: every ip_hash in posts is null today, as
-- the rows predate the guard that writes it.

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'ip_pepper') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'ip_pepper',
      'HMAC key for public.req_ip_hash (F3, 2026-08-28)'
    );
  end if;
end $$;

create or replace function public.req_ip_hash() returns text
language plpgsql stable security definer set search_path = public, extensions as $fn$
declare hdrs json; ip text; pepper text;
begin
  select decrypted_secret into pepper from vault.decrypted_secrets where name = 'ip_pepper';
  -- Fail closed, the way school-verify does. A missing pepper must not quietly
  -- degrade to the unsalted digest this migration exists to remove.
  if pepper is null or char_length(pepper) < 32 then
    raise exception 'req_ip_hash: pepper is not configured' using errcode = '55000';
  end if;

  begin hdrs := current_setting('request.headers', true)::json;
  exception when others then hdrs := null; end;
  ip := coalesce(hdrs->>'cf-connecting-ip', split_part(coalesce(hdrs->>'x-forwarded-for',''), ',', 1), 'local');
  if ip = '' then ip := 'local'; end if;

  return encode(hmac(ip, pepper, 'sha256'), 'hex');
end $fn$;

-- The function was executable by anon and authenticated, which handed any
-- caller a free oracle: POST /rest/v1/rpc/req_ip_hash returned your own hash, so
-- an unsalted digest could be confirmed against a guessed IP without even
-- reading the table. Nothing legitimate calls it directly — it is reached only
-- from posts_guard and room_guard, both SECURITY DEFINER and owned by postgres.
revoke execute on function public.req_ip_hash() from public, anon, authenticated;
