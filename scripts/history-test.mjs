// The record persists; the map does not lie.
import { chromium } from 'playwright-core'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
const pass = readFileSync('.env', 'utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({ host: 'aws-0-us-east-2.pooler.supabase.com', port: 5432, database: 'postgres', username: 'postgres.hxmjszgvkynrwscelnzx', password: pass, ssl: 'require', onnotice: () => {} })
const BASE = process.argv[2] || 'http://localhost:5180/out-dc/'
const CAP = 'history fixture — was here earlier'

await sql.unsafe('alter table posts disable trigger posts_guard')
const [u] = await sql`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'outdc.hist@example.com', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', ${sql.json({ username: 'hist.tester' })}) returning id`
const [post] = await sql`insert into posts (spot_id, title, username, author_id, created_at, expires_at, is_demo)
  values ('shaw', ${CAP}, 'hist.tester', ${u.id}, now() - interval '4 hours', now() - interval '1 hour', false) returning id`
await sql.unsafe('alter table posts enable trigger posts_guard')

const browser = await chromium.launch({ channel: 'chrome' })
const p = await browser.newPage({ viewport: { width: 390, height: 800 } })

// 1. the spot remembers
await p.goto(`${BASE}?spot=shaw`)
await p.waitForTimeout(8000)
const inHistory = await p.evaluate((c) => [...document.querySelectorAll('.rec-title')].some((e) => e.textContent.includes(c)), CAP)
const stamp = await p.evaluate(() => document.querySelector('.rec-when')?.textContent || '')
console.log("in Shaw's who's-been-here:", inHistory, '| stamped:', stamp)

// 2. the map does not show it as current
const onMap = await p.evaluate((c) => {
  const badges = [...document.querySelectorAll('.gmark-count')].filter((b) => !b.hidden)
  return { liveBadges: badges.length, bodyMentions: document.body.textContent.includes(c) }
}, CAP)
await p.click('.sheet-close')
await p.waitForTimeout(1200)
const mapClean = await p.evaluate((c) => ![...document.querySelectorAll('.tonight-rail, .tp-rows')].some((e) => e.textContent.includes(c)), CAP)
console.log('not presented as live on the map:', mapClean)

// 3. the author's profile keeps its archive
await p.goto(BASE)
await p.waitForTimeout(7000)
await p.click('.tab-item:has-text("Feed")')
await p.waitForTimeout(2600)
const inFeedWithAge = await p.evaluate((c) => {
  const card = [...document.querySelectorAll('.mas-card')].find((e) => e.textContent.includes(c))
  return card ? { shown: true, meta: card.querySelector('.mas-when')?.textContent.trim() } : { shown: false }
}, CAP)
console.log('in the feed, labelled by age:', JSON.stringify(inFeedWithAge))

await sql`delete from posts where id = ${post.id}`
await sql`delete from auth.users where id = ${u.id}`
await sql.end()
await browser.close()
