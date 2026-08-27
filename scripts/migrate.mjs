// Apply SQL migrations in order. node scripts/migrate.mjs <file...>
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
const pass = readFileSync('.env', 'utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({ host: 'aws-0-us-east-2.pooler.supabase.com', port: 5432, database: 'postgres', username: 'postgres.hxmjszgvkynrwscelnzx', password: pass, ssl: 'require', onnotice: () => {} })
for (const f of process.argv.slice(2)) {
  await sql.file(f, { simple: true })
  console.log('applied', f)
}
await sql.end()
