# Security

## What this file is

Two different audits get called "security", and hum. only had one of them.

The one it had asks **can an attacker reach data they shouldn't?** That is the
RLS work — twelve adversarial suites run against the live database. It is in
good shape and it is not what this file is about.

The one this file is about asks **who gets hurt, and by whom?** The answers are
mostly people already inside the trust boundary: the ex, the moderator, the
person holding the database password, Supabase, a subpoena. Row-level security
is powerless against every one of them, which is why every one of those passing
access-control checks said nothing about the findings below.

Both matter. Neither substitutes for the other.

## Who gets hurt

The reusable part of this document. When you add anything — a field, a tier, an
export, a page — walk this list and ask what it does to each person.

**The student being followed by someone who knows them.** The largest risk this
app carries, because a map of where somebody goes is the thing it is for. An ex,
a fixated classmate, someone who was asked to stop. They do not need to break
anything; they need the product working as designed.

**The student de-anonymised by inference.** Nobody has to publish a fact for the
pattern to reveal it. Which org's events, which place of worship, which clinic,
which meeting, who they turn up alongside and how often. A handle plus a
campus plus enough timestamps is a name.

**The student in front of an institution.** A conduct office, a landlord, a
subpoena, an immigration authority. This is a DC campus app: students here
attend protests, and some of them are on visas. What we retain, we retain on
their behalf and can be compelled to produce.

**The student being harassed where moderation cannot see.** Private groups are
invisible by design. That is the point of them and also the cost of them.

**The person a moderator is curious about.** Moderator powers are narrow and
enforced, but the temptation is structural rather than personal.

**Everybody, if the database leaks.** Assume it will. Then ask what each column
is worth to whoever has it, which is the question that produced two of the
findings below.

## When to run one

Not on a calendar — nobody keeps those. Run one when the blast radius widens:

- a new kind of data is stored, or an existing one gets a new column
- a new audience tier, or a change to who can see an existing one
- anything that leaves the app: a share page, an OG tag, an export, a webhook
- anything granting a person power over another person
- before public launch, and before the first campus outside AU

## What the database actually holds

Every table in `public` has RLS enabled. Four have zero policies
(`live_cache`, `place_cache`, `push_log`, `school_challenges`) — that is
deny-all to clients and deliberate; they are service-role only.

Personal data, honestly listed:

| Where | What | Notes |
|---|---|---|
| `profiles` | username, bio, school, suspension state | world-readable by policy, but `full_name` is no longer readable, writable or populated — see F6. Suspension state and reason are still public |
| `posts` | spot, lat/lng, time, author, audience, `ip_hash` | `audience = 'city'` is world-readable **while live**; the durable archive is the author's only — see F1. `ip_hash` is keyed — see F3 |
| `age_checks` | date of birth | kept off `profiles` on purpose, so it is not world-readable |
| `school_verifications` | school domain, keyed address hash | the address itself is never stored |
| `dm_messages`, `group_messages`, `room_messages` | message bodies | deleted on a clock: 180 days / 7 days / 6 hours — see F2 |
| `impressions` | who saw which post, and where | a per-person viewing history; nothing reads it back, and it is now deleted at 30 days |
| `push_subs` | endpoint + keys | a push endpoint is a stable per-device identifier |
| `admin_reads` | which moderator opened which thread | append-only |

Beyond the app: Supabase holds auth logs and IPs at the platform level, Resend
holds delivery logs for verification mail, OpenFreeMap sees tile requests, and
GitHub Pages sees page requests. We do not control the retention on any of it.

**Retention is enforced, not implied.** `purge_expired()` runs hourly under
`pg_cron`; the windows are readable by anyone in `public.retention_policy`, and
every run records what it removed in `purge_log`. See F2 for the two categories
that are deliberately exempt.

## Standing findings

### F8 — `.edu` verification was bypassable in one signup. FIXED 2026-08-27

The instant path trusted `email_confirmed_at` as proof of mailbox control and
called the emailed code "theatre". It was the reverse. Supabase auto-confirm is
on, so `email_confirmed_at` is stamped at signup for *every* account — it proves
only that confirmation is switched off. Registering as
`anything@american.edu`, an address you have never seen, returned
`{"status":"verified","instant":true}` and a real `school_verifications` row.
That is the entire campus tier and the institutional gate on private groups, for
the price of a signup. Verified by executing it.

Now the instant path requires an OAuth provider that actually verified the
address (`app_metadata.provider === 'google'`) — you cannot obtain a Google token
for a mailbox you do not control. Every password signup goes to the emailed
code, which is where it always belonged. Legitimate students signing in with
their university Google account still skip the code.

`school-verify-test.mjs` previously asserted the vulnerable behaviour as a
requirement; it now asserts the refusal.

### F9 — `busy-live` was an open proxy to a paid API. FIXED 2026-08-27

Unauthenticated, and it took `venue_name` and `venue_address` **from the
caller**, passing them to BestTime with the private key. Anyone could price any
venue on earth against our account. Worse, the 20-minute cache was keyed on a
caller-supplied `spot_id`, so any request with a fresh string was a cache miss
and therefore a paid call — the cache read as protection against exactly this
and was none.

The venue list is no longer the caller's to choose: it lives in `spot_venues`,
and an unknown `spot_id` never reaches BestTime. A `take_api_credit()` ceiling
caps spend at 60 calls an hour regardless of caller behaviour, degrading to
stale numbers instead of to a bill.

Deliberately still callable without a session — signed-out visitors are meant to
see how busy a place is. Authentication was never the fix here; removing the two
abuse primitives was.

### F10 — Reserved names were enforced at two doors out of four. FIXED 2026-08-28

The earlier note claimed institutional names were refused "at both doors" — the
claim form and the orgs table. There were four, and the two that were open are
the two an attacker would use:

- **Signup.** `handle_new_user` sanitized the charset and deduped, and never
  called `is_reserved()`. `@humsupport` was free.
- **Rename.** `profiles_guard` is `BEFORE UPDATE` and never looked at `username`
  at all, so any account could simply rename itself into a reserved handle
  afterwards. No crafted signup metadata needed — an ordinary profile edit. This
  is the easier attack and the one the first write-up missed.

Plus a third problem of my own making: the rename migration inserted every
`hum*` token in `exact` mode, so "hum. Support Team" tokenized to
`humsupportteam` and matched nothing. Tokens long enough to be unambiguous are
now `contains`; `hum` itself stays `exact`, because in containment mode it would
refuse Humphrey and Humberto.

`full_name` is kept — people type it and group requests display it — but it now
faces the same check and a server-side length cap; the 40-character limit lived
only in the client. At signup a reserved display name is nulled rather than
raised, because an exception inside that trigger fails the whole signup with an
opaque error; on a later edit the guard raises properly, where the person can
see and fix it.

Asserted by `impersonation-test.mjs` (26 checks), including that a name merely
*containing* "hum" still goes through.



### F11 — A report died with the person who filed it. FIXED 2026-08-28

Found while building the deletion path, not by the audit. Every reporter link
was `ON DELETE CASCADE`: `dm_reports.reporter_id`, `room_reports.reporter_id`,
`group_reports.reporter_id`, `reports.user_id`. Deleting your account destroyed
every report you had ever filed, open ones included.

The person this hurts is not the attacker. It is the student who reported a
harasser and then deleted her account to get away from him — the case against
him leaves with her, and the only way to keep it was to stay. "Some deletions
are the harm" was already written down for blocks; this is the same rule one
table over.

Those links are `ON DELETE SET NULL` now, so a report outlives its reporter with
the reporter detached. Asserted in `deletion-test`: a report filed by the leaver
still exists, has no reporter, and is still open.

**Residual, stated rather than hidden:** `room_reports.reporter_id` is half of
that table's primary key `(message_id, reporter_id)`, which dedupes repeat
reports, so it cannot be made nullable. A room report still goes when its
reporter leaves. What changed is that the reported *message* no longer goes with
it — `room_messages.author_id` is `SET NULL` — so the words survive even when
that particular report does not. Closing it properly means re-keying
`room_reports` on a surrogate id.

### F12 — The WMATA functions were open, uncached and unvalidated. FIXED 2026-08-28

Three edge functions hold the WMATA key server-side and answered any
unauthenticated caller: `metro-alerts`, `train-times`, `train-trip`.

`train-times` validated `codes` by **shape only** — `/^[A-Z0-9,]{2,24}$/` accepts
`ZZ,QQ,XX` — so the caller decided what we asked WMATA about, with no cache at
all, meaning one upstream call per request. `train-trip` was worse: every request
fetched the full GTFS-RT TripUpdates protobuf *and* the incidents feed in
parallel, two upstream calls each, one a large binary. `metro-alerts` cached in
module scope, which is per isolate and therefore bounds nothing across a burst.

The precedent is F9's and so is the reasoning: **the fix is not authentication.**
Signed-out visitors are meant to see when the next train is, and requiring an
account to read the Metro board would break the product to fix an abuse problem.
What goes is the abuse primitive.

- Station codes and line ids are checked against server-side truth
  (`stations.json`); an unknown code never reaches WMATA.
- Answers are cached in `public.api_cache`, shared across isolates, with keys
  normalised (sorted, de-duplicated) so equivalent requests are one entry.
- `train-trip` reuses the incidents entry `metro-alerts` already keeps instead of
  fetching a second copy.
- All three sit behind `take_api_credit('wmata', …)`, the same hourly ceiling
  busy-live uses. Past it they serve stale rather than going upstream.

The cost of exhausting this key is not a bill, it is the Metro board going dark
for real users — a denial of service paid for in someone else's quota.

All three also now require the publishable key, which they did not before: they
answered a request carrying no credentials at all. That is a speed bump, not a
trust boundary — the key is in the client bundle — but it filters callers who
never read the bundle, and it costs signed-out visitors nothing.

**`verify_jwt` is declared in `supabase/config.toml` now.** It previously lived
only as per-function state inside Supabase, written down nowhere, invisible to
review, and silently flippable by passing `--no-verify-jwt` to any deploy. It
was checked against `busy-live`, which nothing touched that day, to establish
what the setting had actually been rather than assuming. `busy-live` stays
`false` on purpose, per F9.

### F13 — The purge silently stopped purging DMs. FOUND AND FIXED 2026-08-28

Introduced by F11's own fix, in the same session, and worth recording because
the failure shape is the one this repo keeps meeting.

Making `dm_reports.thread_id` nullable broke two purge predicates written when it
could not be:

```
thread_id not in (select thread_id from public.dm_reports where reviewed_at is null)
```

`NOT IN` against a set containing NULL is NULL — never true — for every row. So
one detached report, exactly what the new deletion path creates, switched off
retention for `dm_messages` and `dm_threads` entirely. No error. The purge went
on reporting "0 rows", which is also what it reports when there is nothing to do.

Caught by `retention-test`, which seeds backdated rows and asserts both
directions. That suite exists because "a purge that silently does nothing reports
the same 0 rows as a purge with nothing to do" — and this is the first time that
reasoning caught a live regression rather than a hypothetical one.

The subqueries now say `and thread_id is not null`. `deletion-test` also cleans
up detached reports, because leaving one behind would break retention for every
later run of anything.

### F1 — Public post history was permanent, per-person, and needed no account. FIXED 2026-08-28

`posts: read the public record` was `removed_at is null and audience = 'city'`.
No `to authenticated`, no time bound. `20260826_durable_history.sql` dropped the
`expires_at` check deliberately so profile grids would work.

Any logged-out stranger could enumerate where a named student had been, with
timestamps, indefinitely — and `ProfilePage` rendered it as a map of their
haunts. Not a bug: a product decision that was never stated to the people it
applied to, and one they could not opt out of.

Avi's rule (2026-08-28): *people should not be able to see exactly where other
people are.*

What was **not** the fix: stopping the per-person query. RLS is row-level, so it
cannot tell a query filtered by username from one filtered by spot, and anyone
holding the publishable key can page the table either way and sort it afterwards.
The only enforceable version of the rule is to bound what is readable at all.

- **Public reads are live posts only.** Saying "I'm at Dupont" is an explicit act
  with an expiry on it, and it stays public. The durable archive does not.
- **The author keeps their whole archive**, through the existing
  `posts: authors read their own`, unbounded.
- **Seeded demo content is exempt**, because it is fictional people and it is
  what keeps the city looking inhabited.
- **The campus tier got the same bound**, since a verified classmate enumerating
  a classmate is the same harm with a smaller gallery.

`expires_at` stops being something that "reads like a privacy control and is
not one". It now governs the record as well as the map.

Verified by rendering, not by reading the policy: `history-test`
seeds one expired and one live post, then checks what the REST API hands a
logged-out browser (the live one only) against what it hands the author (both).
`rls-attack` carried a check that asserted the *opposite* — "expired post
readable as history (by design)" — a passing test with the vulnerability encoded
in it as a requirement. It is inverted, not deleted, because this file has now
had one of those and should keep the scar.

### F2 — "Ephemeral" was a read filter, not deletion. FIXED 2026-08-27

Room messages said six hours, group messages seven days, and both were
`expires_at > now()` in a **read policy** while the row sat there indefinitely,
along with every expired post and every DM ever sent. The blast radius of a leak
or a subpoena was the whole history of the app, and the interface was telling
students something untrue.

The clock now deletes. `purge_expired()` runs hourly under `pg_cron`, windows
live in the world-readable `public.retention_policy` table — a privacy promise
in machine-readable form rather than copy that drifts — and every run records
what it removed in `purge_log`.

Rooms 6 hours, groups 7 days, DMs 180 days, unanswered message requests 30 days,
posts 90 days (demo content exempt), impressions 30 days, moderation records 90
days from *review* rather than from filing, the moderator audit log 2 years.

Two rules the purge obeys that matter more than the windows:

- **Evidence outlives the window.** A reported room message or post is held
  until it has been acted on, because `room_reports` cascades from the message
  and the report would otherwise vanish with the thing it is about.
- **Some deletions are the harm.** `blocks` are never purged — expiring one
  silently un-blocks somebody. Neither are `age_checks` (a purged birth date
  lets a minor re-declare), nor identity and membership rows. These are listed
  explicitly at the top of the migration.

Asserted by `scripts/retention-test.mjs` (24 checks), which seeds backdated rows
and proves both directions — what should go is gone, what must survive did. A
purge that silently does nothing reports the same "0 rows" as a purge with
nothing to do, so testing only the second was never going to be enough.

**Closed inside F2 on 2026-08-28: there is an account-deletion path.**
`delete_my_account()`, offered in the account sheet behind a typed confirmation,
immediate rather than a thirty-day grace period. It is not one `DELETE`, because
the schema did three different things with a departing user and two were wrong:

- `posts.author_id` was `ON DELETE SET NULL`, so posts **survived** the account
  with the username still printed on them. Deleting your account would have left
  your posts on the map under your name. The opposite of the expected bug, and
  the easiest to miss.
- `room_messages.author_id` was `ON DELETE CASCADE`, so a reported message
  vanished and took `room_reports` with it.
- Every `*_reports.reporter_id` was `ON DELETE CASCADE` — see F11.

Held content is detached rather than deleted, using the purge's own predicates
verbatim so there is one definition of "acted on" and not two. A DM thread
cannot be detached from its participants, so an open report takes a snapshot of
it first and the report survives the thread; moderators read that snapshot
through `read_preserved_thread`, which logs to `admin_reads` exactly as the live
path does. Asserted by `scripts/deletion-test.mjs`, 19 checks.

Two consequences named rather than discovered later: blocks go in both
directions (the account they protected against can no longer be reached by it
either, and a returning person is a new account regardless), and `age_checks`
goes, so someone who deletes and re-registers re-declares their birth date —
no weaker than any first-time signup, which is the honest bar for F7.

### F3 — `ip_hash` was an IP address in a thin disguise. FIXED 2026-08-28

`req_ip_hash()` returned `encode(digest(ip || '', 'sha256'), 'hex')` — unsalted,
with an empty concatenation sitting exactly where a salt was once intended.

Demonstrated rather than argued. Called over the live REST API from a laptop it
returned `441d45b7…`; `sha256` of that laptop's public IP is `441d45b7…`. One
guess. No rainbow table, no 2^32 sweep. Worse, `req_ip_hash` was executable by
`anon`, so `POST /rest/v1/rpc/req_ip_hash` handed any caller their own hash as a
free oracle — the reverse lookup did not even need the table.

Now HMAC-SHA256 under a key from Supabase Vault, read at call time, failing
closed if the secret is absent rather than degrading to the old digest. Execute
is revoked from `anon` and `authenticated`; nothing legitimate calls it directly,
only `posts_guard` and `room_guard`, both `SECURITY DEFINER`.

**Not a server setting, which is what this file previously prescribed.** A GUC
set with `ALTER DATABASE` only reaches sessions opened afterwards, and PostgREST
holds connections open for a long time; between the migration and those
connections recycling, every post and room message on the live site would have
been refused. Vault is read per call, so the swap is atomic, and its encryption
key lives outside the database — closer to "the pepper cannot live in the same
database as the hashes" than a GUC in the catalog was.

Nothing was migrated: you cannot un-hash to re-hash, and there was nothing to
migrate anyway — every `ip_hash` in `posts` was null, the rows predating the
guard that writes it.

### F4 — Unsalted address hashes. FIXED 2026-08-27

`sha(address)` for the one-mailbox-one-account check. School addresses are
formulaic — `aw2218a@american.edu` is initials, digits, a letter — so one
school's whole space is ~10^7 candidates and a leaked table was a list of real
students' email addresses.

It cannot be salted per user, because the check only means anything if the hash
matches across accounts. So it is keyed: HMAC-SHA256 under `SCHOOL_HASH_PEPPER`,
which lives only in the function's environment. The function fails closed if the
secret is absent rather than degrading to the old behaviour. Legacy digests were
cleared, not migrated — you cannot un-hash to re-hash.

### F5 — Moderator reads were unrecorded. FIXED 2026-08-27

The permission was right; there was no record that a read had happened. A log a
moderator can route around is decoration, so the direct read policy on
`dm_messages` was removed and `read_reported_thread()` is now the only door: it
checks the report is open, writes `admin_reads`, then returns messages. No
update or delete policy on the log for anyone. CLI reads log as `via 'cli'` with
a null `admin_id`, because that reader is whoever holds the database password.

**Open sub-question:** `admin_reads` is readable by moderators but not by the two
people in the thread. Showing them is the more honest design; the objection is
that a reported harasser learning the minute a moderator looked is a tip-off
exactly when it matters. Unresolved.

### F6 — `profiles` was world-readable including `full_name`. FIXED 2026-08-28

Policy is `using (true)`. This was filed LATENT because `full_name` is empty in
every row, and that was still true when re-checked: 0 of 10. Latent is not
harmless. The signup form collected a name, `handle_new_user` wrote it, and
`ProfilePage`, `ProfileSheet`, `MessagesSheet` and `GroupsPanel` all rendered it.

The fuse was the Google consent screen. Publishing it — which is on the list for
the 50-student push — makes Google hand us `full_name` in `raw_user_meta_data` on
every OAuth signup, at which point this table starts publishing real students'
legal names to logged-out strangers. The finding said "with no code change and no
review"; the change that would have armed it is a checkbox in a Google console,
not a commit.

Asked how far to go, Avi (2026-08-28): *"whatever you think is best."* So hum. is
pseudonymous by construction now. `@username` is the identity the interface
already led with; a real name was a second, weaker identifier nobody asked for
and nobody could remove once OAuth began filling it in.

- `handle_new_user` no longer reads `full_name` from signup metadata at all.
- `profiles_guard` freezes it, so it cannot be filled in by a later edit.
- The table-level `SELECT`/`UPDATE`/`INSERT` grants were revoked and re-granted
  per column, without it — a single column cannot be revoked out of a
  table-level grant.
- The signup form no longer asks for a name, and the four components fall back
  to `@username`.

The column is kept, not dropped: it holds no data, and a drop is the one step
that could not be walked back.

Shipped in two halves on purpose. Revoking the column privilege makes PostgREST
refuse any request that *names* the column, and the bundle live on GitHub Pages
named it in four places — applied together this would have 403'd profile reads
on the live site between the migration and the deploy.

**Still open, deliberately:** `suspended_reason` is world-readable for the same
reason `full_name` was. It is the literal string `reported conduct` on every row
today, and closing it properly means a moderator-only RPC in the shape of
`read_reported_thread`, because moderators read it as plain `authenticated`.
Noted rather than half-done.

### F7 — Age is self-declared. ACCEPTED, pending advice

A date-of-birth field stops nothing on its own. Accepted for now; several US
states have minor-social-media statutes with contested and shifting status, and
this wants a lawyer before public launch rather than a better input.

## Guarantees asserted by tests

A finding becomes a test, or it decays back into an intention. Each of these
fails loudly if someone erodes it:

- a group has no spot, lat, lng or audience column — it **cannot** reach the map — `groups-attack`
- an org is world-readable and cannot be hidden — `groups-attack`
- no dorm, floor, building or residence is stored anywhere — `groups-attack`
- campus posts reach verified classmates of the author's school and nobody else — `school-verify-test`
- the stored address hash is keyed, not a digest anyone can recompute — `school-verify-test`
- a moderator reads a reported thread only while the report is open — `moderator-attack`
- the read is logged, and the log cannot be edited or erased by anyone — `moderator-attack`
- no institutional name can be claimed, renamed into, or used for a group — `impersonation-test`
- a blocked person cannot tell they were blocked — `dm-attack`
- an expired post is **not** readable by a stranger, while its author keeps the
  whole archive — `rls-attack`, `history-test`
- a display name cannot be set or read back at all — `impersonation-test`
- deleting an account removes it, keeps what is under an open report, and
  detaches that from the person — `deletion-test`
- a report outlives the person who filed it — `deletion-test`
- what should go is gone and what must survive did, in both directions —
  `retention-test`
- outsiders are **filtered**, asserted as `!error && length === 0`, never bare
  `length === 0` — an RLS recursion error is indistinguishable from an empty
  result otherwise, and two tests once passed on exactly that

Run everything before trusting a migration — **in batches, with a pause.**
Supabase throttles signups, and running all of these back to back returns
`over_request_rate_limit` partway through; the suites then fail with
`Cannot read properties of null (reading 'id')` at `mk()`, which looks exactly
like a code regression and is not. Worse, `mk()` sits outside the try/finally in
most suites, so a crash there strands accounts the next run cannot recreate
while the limit holds.

```bash
# batch 1
for s in rls-attack org-rls-attack impersonation-test; do node scripts/$s.mjs || echo "FAILED: $s"; done
sleep 300
# batch 2
for s in room-attack dm-attack groups-attack; do node scripts/$s.mjs || echo "FAILED: $s"; done
sleep 300
# batch 3
for s in moderation-test moderator-attack school-verify-test org-membership-test; do node scripts/$s.mjs || echo "FAILED: $s"; done
sleep 300
# batch 4 — these two build their fixtures with direct SQL, so they do not
# touch the signup budget and can run any time
for s in retention-test deletion-test; do node scripts/$s.mjs || echo "FAILED: $s"; done
```

Run on 2026-08-28, all green: `rls-attack` 12, `org-rls-attack` 17,
`impersonation-test` 26, `room-attack` 18, `dm-attack` 33, `moderation-test` 16,
`moderator-attack` 26, `retention-test` 24, `deletion-test` 19. Not re-run that
day: `school-verify-test`, `org-membership-test`, `groups-attack` — nothing in
this batch of changes touches verification, membership or groups, but that is a
reason to expect them green, not evidence that they are.

## Things we deliberately do not do

- no dorms, floors, buildings or residence data — there is nothing to enumerate
- no RA or other university-employee role — that would put part of somebody's
  job in a system their employer cannot retain records from
- no precise live location; posts attach to a spot, not to a person's position
- no reading a DM thread without an open report on it
- no follows yet — a social graph before density mostly makes emptiness legible,
  and it is also the machinery that makes someone easy to watch

## Reporting something

If you found a way to hurt somebody with this app, that is worth more to us than
a working feature. Open a private security advisory on the GitHub repo.

> Add a contact address here before launch. It should be one you are willing to
> have permanently public — not a personal mailbox.

## Practice notes

Two habits that have caught more than any checklist:

**The absence of an error is not evidence of an effect.** A guard that never
fired, a policy that never matched, and an edit script that silently replaced
nothing all reported success. Assert the effect, never the lack of a complaint.

**Empty states exercise almost no code.** A page that crashed for exactly the
users who had content tested green against the empty version for a day.

**Verify the path the attacker takes, not the path the user takes.** The `.edu`
chain was recorded as "proven end to end" because the emailed-code path was
driven by a real student to a real inbox. The instant path beside it was never
tested at all, and it was the open one. A feature is not proven by its happy
path.

**A test can encode the bug as a requirement.** `school-verify-test` asserted
"an account signed in with a school address verifies instantly" — the
vulnerability, written down as a guarantee and defended by 31 passing checks.
When a finding contradicts a green test, suspect the test.

**Supabase throttles signups** (`over_request_rate_limit`), discovered by
tripping it with eleven suites back to back. Good news for account farming;
awkward for the harness, since `mk()` sits outside the try/finally in most
suites, so a crash there strands test accounts that the next run cannot
recreate while the limit holds.
