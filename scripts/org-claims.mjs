// Review the org claim queue. This is the "off-client" half of the claim
// flow: org_claims has no update policy, so approval cannot happen from the
// app at all — it happens here, over a direct connection, by a person who
// looked at the evidence.
//
//   node scripts/org-claims.mjs                 # what's waiting
//   node scripts/org-claims.mjs approve <id>    # make the filer's account the org
//   node scripts/org-claims.mjs deny <id>       # close it without granting
//
// Approving turns the FILING ACCOUNT into the org account — same account, new
// kind. Whoever filed should have signed up for the group, not used their own
// profile; the claim sheet says so, and the summary below shows you the handle
// so you can catch it before you approve.
import postgres from 'postgres'
import { readFileSync } from 'node:fs'

const pass = readFileSync('.env', 'utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({ host: 'aws-0-us-east-2.pooler.supabase.com', port: 5432, database: 'postgres', username: 'postgres.hxmjszgvkynrwscelnzx', password: pass, ssl: 'require', onnotice: () => {} })

const [cmd, id] = process.argv.slice(2)
const ago = (t) => {
  const h = Math.round((Date.now() - Date.parse(t)) / 36e5)
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`
}

const list = async () => {
  const rows = await sql`
    select c.id, c.org_name, c.school_domain, c.evidence, c.created_at,
           p.username, p.kind, u.email
    from org_claims c
    join profiles p on p.id = c.user_id
    join auth.users u on u.id = c.user_id
    where c.reviewed_at is null
    order by c.created_at`
  if (!rows.length) { console.log('Nothing waiting.'); return }
  console.log(`${rows.length} claim${rows.length > 1 ? 's' : ''} waiting:\n`)
  for (const r of rows) {
    console.log(`  ${r.id}`)
    console.log(`    ${r.org_name}  ·  ${r.school_domain}  ·  filed ${ago(r.created_at)}`)
    console.log(`    account:  @${r.username}  <${r.email}>${r.kind === 'org' ? '  (ALREADY AN ORG)' : ''}`)
    console.log(`    evidence: ${r.evidence || '(none given)'}`)
    // the address is the cheapest signal there is: a claim on gwu.edu filed
    // from a gmail account is not proof of anything
    const domain = (r.email.split('@')[1] || '').toLowerCase()
    const matches = domain === r.school_domain || domain.endsWith('.' + r.school_domain)
    console.log(`    ${matches ? '✓ signed up with a school address' : '· signed up with ' + domain + ' — check the evidence'}\n`)
  }
}

const decide = async (approve) => {
  if (!id) { console.log('which claim? pass the id from the list'); process.exit(1) }
  const [claim] = await sql`
    select c.*, p.username from org_claims c join profiles p on p.id = c.user_id
    where c.id = ${id}`
  if (!claim) { console.log('no claim with that id'); process.exit(1) }
  if (claim.reviewed_at) { console.log(`already reviewed — ${claim.approved ? 'approved' : 'denied'}`); process.exit(1) }

  if (approve) {
    // profiles_guard freezes kind for any caller carrying a JWT; this
    // connection has none, which is exactly the seam approval runs through
    await sql`update profiles
      set kind = 'org', school_domain = ${claim.school_domain}, claimed_at = now()
      where id = ${claim.user_id}`
  }
  await sql`update org_claims set reviewed_at = now(), approved = ${approve} where id = ${id}`

  const [after] = await sql`select kind, school_domain from profiles where id = ${claim.user_id}`
  console.log(approve
    ? `Approved. @${claim.username} is now ${claim.org_name} (${after.kind}, ${after.school_domain}).\n` +
      `They can post as the group, and choose Campus only for anything not meant for the whole city.`
    : `Denied. @${claim.username} keeps their personal account; nothing was granted.`)
}

if (cmd === 'approve') await decide(true)
else if (cmd === 'deny') await decide(false)
else await list()
await sql.end()
