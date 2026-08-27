// Give the demo cast a posting record, so profiles and spot sheets look like
// somebody has been using the app.
//
// Every row is is_demo = true, which drives the DEMO tag on every surface and
// excludes it from the retention numbers — the gate question stays honest.
//
//   node scripts/seed-demo-posts.mjs         # create (idempotent)
//   node scripts/seed-demo-posts.mjs clear   # remove every demo post + account
import postgres from 'postgres'
import { readFileSync } from 'node:fs'

const pass = readFileSync('.env', 'utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({ host: 'aws-0-us-east-2.pooler.supabase.com', port: 5432, database: 'postgres', username: 'postgres.hxmjszgvkynrwscelnzx', password: pass, ssl: 'require', onnotice: () => {} })

// which photos exist, so a demo post only claims one it can actually show
const photosJs = readFileSync('src/data/photos.js', 'utf8')
const hasPhoto = new Set([...photosJs.matchAll(/"([a-z0-9_]+)":\s*\{\s*"src":\s*"photos\//g)].map((m) => m[1]))
const SITE = 'https://aviwise.github.io/hum'
const photoFor = (spot) => (hasPhoto.has(spot)
  ? { photo_path: `${SITE}/photos/${spot}.jpg`, mid_path: `${SITE}/photos/${spot}-480.webp`, thumb_path: `${SITE}/photos/thumb/${spot}.webp` }
  : {})

// Each line: [author, spot, hours ago, how long it ran, what they said]
// Written in each character's voice and at places their profile already claims.
const POSTS = [
  ['out.demo.marcus', 'gravelly', 20, 3, 'Planes coming in low over the blanket — stayed til the sun went'],
  ['out.demo.marcus', 'meridian', 44, 4, 'Whole hill facing west for the sunset, someone brought a speaker'],
  ['out.demo.marcus', 'iwojima', 92, 3, 'Lincoln, the Monument and the Capitol all in one frame from up here'],
  ['out.demo.marcus', 'roosevelt', 140, 4, 'Herons on the boardwalk, nobody else on the island'],

  ['out.demo.maya', 'kogod', 26, 5, 'Rain outside, glass roof, laptops everywhere — best free desk in the city'],
  ['out.demo.maya', 'phillips', 50, 4, 'Rothko room to myself for a solid ten minutes'],
  ['out.demo.maya', 'folger', 74, 3, 'The new underground halls are open and almost empty on a weekday'],
  ['out.demo.maya', 'hirshhorn', 122, 4, 'Sculpture garden before the heat, coffee from the cart'],

  ['out.demo.jordan', 'admo', 15, 5, 'Eighteenth is packed, line at the jumbo slice already halfway down the block'],
  ['out.demo.jordan', 'fourteenth', 39, 5, 'Patios full end to end, we ended up at the pinball place'],
  ['out.demo.jordan', 'hstreet', 63, 6, 'Karaoke night, wigs provided, no regrets'],
  ['out.demo.jordan', 'navyyard', 111, 4, 'Game let out and the whole riverfront turned into one bar'],

  ['out.demo.sofia', 'ustreet', 18, 4, 'Doors at 7, opener was better than the headliner, fight me'],
  ['out.demo.sofia', 'anacostia', 42, 4, 'Go-go on the outdoor stage, the pocket on that band is unreal'],
  ['out.demo.sofia', 'songbyrd', 66, 4, 'Hundred and fifty people and the drummer still knew every face'],
  ['out.demo.sofia', 'comet', 114, 4, 'All-ages show in the back room, pizza first, ears ringing after'],

  ['out.demo.dev', 'loc', 30, 6, 'Reading room dome does something to your attention span'],
  ['out.demo.dev', 'bigbear', 54, 5, 'Corner table, cortado, three hours gone'],
  ['out.demo.dev', 'lacolombe', 78, 4, 'Alley side is quieter than the front if you want to actually work'],
  ['out.demo.dev', 'wiseguy', 126, 3, 'Two in the morning slice situation, exactly as needed'],

  ['out.demo.nia', 'banneker', 22, 4, 'Pool deck full, fifty meters of nobody in the lanes though'],
  ['out.demo.nia', 'sankofa', 46, 4, 'Coffee, film books, and the best window seat on Georgia Ave'],
  ['out.demo.nia', 'flash', 70, 6, 'Downstairs floor was moving by eleven'],
  ['out.demo.nia', 'parkview', 118, 4, 'Watch party in the hall, everyone in scarves'],

  ['out.demo.tommy', 'clocktower', 28, 3, 'Free elevator to the best view in the city and there were four of us up there'],
  ['out.demo.tommy', 'exorcist', 52, 2, 'Ran the steps once. Once is enough.'],
  ['out.demo.tommy', 'lincoln', 100, 3, 'Marble at midnight, empty, the reflecting pool doing its thing'],
  ['out.demo.tommy', 'unionstation', 148, 3, 'Main hall at rush hour is the most cinematic room in D.C.'],

  ['out.demo.lena', 'catacombs', 34, 3, 'Replica Roman catacombs under a monastery. Free. Nobody knows.'],
  ['out.demo.lena', 'dupontund', 58, 4, 'Old streetcar station, art in the tunnels, cold in a good way'],
  ['out.demo.lena', 'chbooks', 82, 3, 'Handwritten signs telling you not to discuss politics. Bought two books.'],
  ['out.demo.lena', 'byrdland', 130, 3, 'Dug through the used crates for an hour, came out with three records'],

  // A demo student org posts as itself: what it is putting on, not where it
  // went. Invented group on demo.edu, so no real organization is impersonated.
  ['out.demo.nightowls', 'suns', 6, 4, 'Screening tonight, 9pm — bring a friend, we bought out the room'],
  ['out.demo.nightowls', 'sankofa', 30, 3, 'Post-screening discussion in the back room, open to anyone who shows'],
  ['out.demo.nightowls', 'alamo', 78, 4, 'Group rate on the 10pm quote-along, meet by the doors at 9:45'],
  ['out.demo.nightowls', 'brookland', 126, 3, 'Outdoor projector on the plaza while the weather holds'],
  ['out.demo.nightowls', 'loc', 174, 4, 'Reading room session before the semester eats everyone alive'],
]

// demo accounts that are student orgs rather than people
const DEMO_ORGS = { 'out.demo.nightowls': 'demo.edu' }

if (process.argv[2] === 'clear') {
  const posts = await sql`delete from posts where is_demo = true returning id`
  const users = await sql`delete from auth.users where email like 'demo+%@out.dc' returning id`
  console.log(`removed ${posts.length} demo posts and ${users.length} demo accounts`)
  await sql.end()
  process.exit(0)
}

// one account per character, reusing any that already exist
const authors = [...new Set(POSTS.map((p) => p[0]))]
const ids = {}
for (const username of authors) {
  const email = `demo+${username}@out.dc`
  const [existing] = await sql`select id from auth.users where email = ${email}`
  if (existing) { ids[username] = existing.id; continue }
  const [u] = await sql`
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
      ${email}, crypt(gen_random_uuid()::text, gen_salt('bf')), now(), now() - interval '40 days', now(), '{}',
      ${sql.json({ username })}) returning id`
  ids[username] = u.id
}
console.log(`${authors.length} demo accounts ready`)

// Approval is not self-service, so it happens here — from outside the client,
// the same way a reviewed claim will be approved. profiles_guard allows this
// precisely because there is no auth.uid() on a direct connection.
for (const [username, domain] of Object.entries(DEMO_ORGS)) {
  if (!ids[username]) continue
  await sql`update profiles set kind = 'org', school_domain = ${domain}, claimed_at = now() where id = ${ids[username]}`
}

// the guards exist to stop humans flooding the map; seeding is not that
await sql.unsafe('alter table posts disable trigger posts_guard')
let made = 0
for (const [username, spot, hoursAgo, runsFor, title] of POSTS) {
  const [dupe] = await sql`select id from posts where title = ${title}`
  if (dupe) continue
  await sql`
    insert into posts (spot_id, title, username, author_id, created_at, expires_at, is_demo, photo_path, mid_path, thumb_path)
    values (${spot}, ${title}, ${username}, ${ids[username]},
      now() - (${hoursAgo} || ' hours')::interval,
      now() - (${hoursAgo} || ' hours')::interval + (${runsFor} || ' hours')::interval,
      true,
      ${photoFor(spot).photo_path || null}, ${photoFor(spot).mid_path || null}, ${photoFor(spot).thumb_path || null})`
  made++
}
await sql.unsafe('alter table posts enable trigger posts_guard')

const [{ total }] = await sql`select count(*)::int total from posts where is_demo = true`
const [{ live }] = await sql`select count(*)::int live from posts where is_demo = true and expires_at > now()`
const [{ withphoto }] = await sql`select count(*)::int withphoto from posts where is_demo = true and photo_path is not null`
console.log(`created ${made} · ${total} demo posts total, ${live} currently live, ${withphoto} with photos`)
await sql.end()
