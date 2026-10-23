import pg from "pg"

const dbUrl = "postgresql://brik_qa:577c65b75921ef836d117fd1efb05715008a2485d6ddd423@127.0.0.1:54339/brik_viewing_qa_local"

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
