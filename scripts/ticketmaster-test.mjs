// Proves the Ticketmaster adapter before a key exists, by injecting fetch.
// The failure paths matter more than the happy one: a source that silently
// returns nothing would let the refresh job wipe a good calendar.
import { fetchEvents } from './lib/ticketmaster.mjs'

let pass = 0, fail = 0
const ok = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ' + n) } else { fail++; console.log(`  FAIL ${n}${d ? ' — ' + d : ''}`) } }
const res = (status, body) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => body })
const KNOWN = ['9:30 Club', 'The Atlantis', 'Echostage', 'Black Cat', 'Songbyrd']
const args = { key: 'test', fromISO: '2026-08-28T00:00:00Z', toISO: '2026-09-12T00:00:00Z', knownVenues: KNOWN }

const page = (events, totalPages = 1) => ({ _embedded: { events }, page: { totalPages } })
const ev = (name, venue, localDate, localTime) => ({
  name, dates: { start: { localDate, localTime } }, _embedded: { venues: [{ name: venue }] },
})

console.log('parsing')
{
  const r = await fetchEvents({ ...args, fetchImpl: res(200, page([
    ev('Emo Night Brooklyn', '9:30 Club', '2026-09-04', '21:00:00'),
    ev('Patti Smith', 'The Atlantis', '2026-09-01', '18:30:00'),
    ev('Some Gala', 'Convention Center', '2026-09-02', '19:00:00'),   // not ours
  ])) })
  ok('keeps only venues we track', r.length === 2, `${r.length} rows`)
  ok('date and time parsed', r[0].date === '2026-09-04' && r[0].time === '21:00', JSON.stringify(r[0]))
  ok('venue mapped to our name', r[0].venue === '9:30 Club')
  ok('tagged with its source', r.every((x) => x.source === 'ticketmaster'))
}
{
  const r = await fetchEvents({ ...args, fetchImpl: res(200, page([ev('No Time Listed', 'Echostage', '2026-09-05', null)])) })
  ok('missing time falls back to an evening default', r[0].time === '20:00', r[0].time)
}
{
  const dup = ev('Twice', 'Black Cat', '2026-09-06', '20:00:00')
  const r = await fetchEvents({ ...args, fetchImpl: res(200, page([dup, dup])) })
  ok('duplicates collapse', r.length === 1, `${r.length} rows`)
}

console.log('\nfailure paths — each must THROW, never return []')
const throws = async (n, impl, match) => {
  try { await fetchEvents({ ...args, fetchImpl: impl }); ok(n, false, 'returned instead of throwing') }
  catch (e) { ok(n, !match || e.message.includes(match), e.message) }
}
await throws('rejected key (401)', res(401, {}), 'key rejected')
await throws('rate limited (429)', res(429, {}), 'rate limited')
await throws('server error (500)', res(500, {}), 'HTTP 500')
await throws('200 but matches nothing', res(200, page([ev('Gala', 'Convention Center', '2026-09-02', '19:00:00')])), 'matched none')
try { await fetchEvents({ ...args, key: null, fetchImpl: res(200, page([])) }); ok('no key', false) }
catch (e) { ok('no key throws', e.message.includes('no API key')) }

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
