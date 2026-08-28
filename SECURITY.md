# Security

## What this file is

Two different audits get called "security", and hum. only had one of them.

The one it had asks **can an attacker reach data they shouldn't?** That is the
RLS work — ten adversarial suites, 234 checks, run against the live database.
It is in good shape and it is not what this file is about.

The one this file is about asks **who gets hurt, and by whom?** The answers are
mostly people already inside the trust boundary: the ex, the moderator, the
person holding the database password, Supabase, a subpoena. Row-level security
is powerless against every one of them, which is why 234 passing access-control
checks said nothing about the findings below.

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
| `profiles` | username, bio, school, suspension state, `full_name` | **world-readable, policy `true`.** `full_name` is unpopulated today but exposed the instant anything writes it |
| `posts` | spot, lat/lng, time, author, audience, `ip_hash` | `audience = 'city'` is world-readable to anyone, now bounded to 90 days — see F1 |
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

### F10 — Reserved handles are not enforced at signup. OPEN

`handle_new_user` sanitizes the charset and dedupes, but never calls
`is_reserved()`. That guard covers `orgs` and `groups` — signup is a third door
nobody checked. I registered `@humsupport` with the display name "hum. Support
Team", then deleted it. With DMs live, that is a working phishing setup.

Same block: `full_name` is copied from client-controlled signup metadata into
world-readable `profiles`.



### F1 — Public post history is permanent, per-person, and needs no account. OPEN

`posts: read the public record` is `removed_at is null and audience = 'city'`.
No `to authenticated`, no time bound. `20260826_durable_history.sql` dropped the
`expires_at` check deliberately so profile grids would work.

Any logged-out stranger can enumerate where a named student has been, with
timestamps, indefinitely — and `ProfilePage` renders it as a map. `expires_at`
reads like a privacy control and is not one; it governs the live map only.

Not a bug. A product decision that was never stated to the people it applies to,
and one they cannot opt out of. Options: cap the public grid to a window, make
history opt-in, or coarsen public history to places without times. Needs a
decision, not a patch.

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

**Still open inside F2:** there is no account-deletion path. Content ages out
now, but an account, its profile and its birth date persist until somebody
removes them by hand. Nothing is stored forever *except a person's account*, and
that is the piece left to build.

### F3 — `ip_hash` is an IP address in a thin disguise. OPEN

`req_ip_hash()` returns `encode(digest(ip || '', 'sha256'), 'hex')` — unsalted,
with an empty concatenation where a salt was evidently once intended. IPv4 is
2^32; a complete reverse table is minutes of work. Written to `posts` and
`room_messages` by trigger for rate-limiting and report de-duplication.

Same fix as F4: key it. The pepper cannot live in the same database as the
hashes, which for a trigger means a server setting rather than a column.

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

### F6 — `profiles` is world-readable including `full_name`. LATENT

Policy is `using (true)`. `full_name` is empty in every row today, so nothing
leaks — but the column is exposed, and the first thing that populates it from an
OAuth profile publishes real names with no code change and no review. Suspension
state and reason are public for the same reason.

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
- outsiders are **filtered**, asserted as `!error && length === 0`, never bare
  `length === 0` — an RLS recursion error is indistinguishable from an empty
  result otherwise, and two tests once passed on exactly that

Run everything before trusting a migration:

```bash
for s in rls-attack org-rls-attack school-verify-test org-membership-test room-attack dm-attack moderation-test moderator-attack impersonation-test groups-attack; do node scripts/$s.mjs || echo "FAILED: $s"; done
```

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
