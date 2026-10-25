import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"
import { assertLocalQaTarget, buildLocalQaUrl } from "./local-qa-target.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const envFile = path.join(root, ".qa-local", "pg.env")
if (!existsSync(envFile)) {
  console.error("Missing .qa-local/pg.env. Start local QA PostgreSQL first.")
  process.exit(1)
}
const line = readFileSync(envFile, "utf8").split(/\r?\n/).find((l) => l.startsWith("POSTGRES_PASSWORD="))
if (!line) {
  console.error("POSTGRES_PASSWORD missing in .qa-local/pg.env")
  process.exit(1)
}
const password = line.slice("POSTGRES_PASSWORD=".length)
const dbUrl = buildLocalQaUrl(password)
assertLocalQaTarget(dbUrl)

async function cleanup() {
  const client = new pg.Client({ connectionString: dbUrl })
  await client.connect()
  const res = await client.query(
    "UPDATE brik_by_brik_engine.video_jobs SET state = 'failed', failure_code = 'TEST_CLEANUP' WHERE deal_id != 'deal-17408-blue-jay' AND state IN ('queued', 'processing')"
  )
  console.log("Cleaned old synthetic jobs:", res.rowCount)

  const remaining = await client.query(
    "SELECT id, deal_id, state, created_at, source_path FROM brik_by_brik_engine.video_jobs WHERE state IN ('queued', 'processing')"
  )
  console.log("Remaining queued jobs:", remaining.rows)
  await client.end()
}

cleanup().catch(console.error)
