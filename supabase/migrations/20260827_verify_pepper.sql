-- Retire the unsalted address hashes.
--
-- ORDERING: this must sort AFTER 20260827_school_verification.sql, which
-- creates the tables it touches — hence "verify_", not "hash_". Migrations
-- apply in filename order and a v sorts after an s.
--
-- A plain SHA-256 of an email address is not anonymisation. School addresses
-- are formulaic — aw2218a@american.edu is initials, digits, a letter — so one
-- school's entire address space is on the order of 10^7 candidates, which is
-- seconds of brute force on a laptop. Anyone who walked off with this table
-- walked off with a list of real students' email addresses, not a list of
-- hashes. The code hash two lines below it in the function was already salted;
-- the reasoning just never got carried across to the address.
--
-- It cannot be salted per user the way the code is, because its one job is
-- answering "has this mailbox already verified somebody else?" — a question
-- that only means anything if the hash is the same across accounts. So it is
-- keyed instead: school-verify now computes HMAC-SHA256 under a secret,
-- SCHOOL_HASH_PEPPER, that lives only in the function's environment. Still
-- deterministic, still supports the lookup, and a stolen table without the key
-- is a column of noise.
--
-- The values below were computed the old way and cannot be converted — you
-- cannot un-hash something to re-hash it — so they are cleared, not migrated.
--
-- WHAT THAT COSTS, stated plainly: email_hash is the one-mailbox-one-account
-- check, so for already-verified rows that check is blank until they next
-- verify. The same address could verify a second account in the meantime. The
-- property that actually matters — control of the mailbox — is untouched,
-- because that is proved by the emailed code, not by this column. At one
-- verified user this migration is the cheapest it will ever be; every student
-- who signs up before it makes it more expensive.

update public.school_verifications set email_hash = null where email_hash is not null;

-- pending challenges are minutes old and cost nothing to reissue
delete from public.school_challenges;
