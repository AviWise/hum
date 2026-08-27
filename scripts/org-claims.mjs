// Review the org claim queue. This is the "off-client" half of the claim
// flow: org_claims has no update policy, so approval cannot happen from the
// app at all — it happens here, over a direct connection, by a person who
// looked at the evidence.
//
//   node scripts/org-claims.mjs                        # what's waiting
//   node scripts/org-claims.mjs approve <id> [handle]  # create the group, filer owns it
//   node scripts/org-claims.mjs deny <id>              # close it without granting
//
// Approving creates the GROUP and makes the filer its owner. Their own profile
// is untouched — they keep it, and gain the ability to post as the group. A
// handle is derived from the name unless you pass one.
import postgres from 'postgres'
import { readFileSync } from 'node:fs'

const pass = readFileSync('.env', 'utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({ host: 'aws-0-us-east-2.pooler.supabase.com', port: 5432, database: 'postgres', username: 'postgres.hxmjszgvkynrwscelnzx', password: pass, ssl: 'require', onnotice: () => {} })

const [cmd, id, handleArg] = process.argv.slice(2)
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '')
  .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '').slice(0, 30)
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

  if (!approve) {
    await sql`update org_claims set reviewed_at = now(), approved = false where id = ${id}`
    console.log(`Denied. @${claim.username} keeps their account; nothing was granted.`)
    return
  }

  const handle = handleArg || slug(claim.org_name)
  if (!/^[a-z0-9_.]{3,30}$/.test(handle)) {
    console.log(`"${handle}" won't work as a handle — pass one: approve ${id} <handle>`)
    process.exit(1)
  }
  const [taken] = await sql`select id from orgs where handle = ${handle}`
  if (taken) {
    console.log(`@${handle} is taken — pass a different one: approve ${id} <handle>`)
    process.exit(1)
  }

  // orgs and org_members have no client write policies at all; this connection
  // carries no JWT, which is the only seam either table can be written through
  const [org] = await sql`
    insert into orgs (handle, name, school_domain, claimed_at)
    values (${handle}, ${claim.org_name}, ${claim.school_domain}, now())
    returning id, handle, name`
  await sql`insert into org_members (org_id, user_id, role)
    values (${org.id}, ${claim.user_id}, 'owner') on conflict do nothing`
  await sql`update org_claims set reviewed_at = now(), approved = true where id = ${id}`

  console.log(`Approved. ${org.name} exists at @${org.handle}, owned by @${claim.username}.`)
  console.log(`They keep their own profile and can now post as the group —`)
  console.log(`including Campus only, which reaches verified ${claim.school_domain} students.`)
  console.log(`\n  https://aviwise.github.io/hum/#/o/${org.handle}`)
}

if (cmd === 'approve') await decide(true)
else if (cmd === 'deny') await decide(false)
else await list()
await sql.end()
