#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { Client } from 'pg'

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('Usage: node scripts/exec-sql.mjs <sql-file>')
    process.exit(1)
  }
  const dbUrl = process.env.SUPABASE_DB_URL
  if (!dbUrl) {
    console.error('SUPABASE_DB_URL is not set in the environment')
    process.exit(1)
  }
  const abs = path.resolve(process.cwd(), file)
  if (!fs.existsSync(abs)) {
    console.error('File not found:', abs)
    process.exit(1)
  }
  const sql = fs.readFileSync(abs, 'utf8')
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    await client.query(sql)
    console.log('Applied:', path.basename(file))
  } catch (e) {
    console.error('EXEC SQL FAILED:', e.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('UNEXPECTED:', e)
  process.exit(1)
})
