import fs from "node:fs"
import path from "node:path"
import dns from "node:dns/promises"
import { Pool } from "pg"

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  const envLocalPath = path.resolve(process.cwd(), ".env.local")
  const envText = fs.readFileSync(envLocalPath, "utf8")
  const match = envText.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?\s*$/m)

  if (!match) {
    throw new Error("DATABASE_URL not found in environment or .env.local")
  }

  return match[1]
}

async function normalizeConnectionString(connectionString: string) {
  const url = new URL(connectionString)

  try {
    await dns.lookup(url.hostname)
    return { connectionString, fallback: null }
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("ENOTFOUND")) {
      throw error
    }

    const ipv6Hosts = await dns.resolve6(url.hostname)
    if (ipv6Hosts.length === 0) {
      throw error
    }

    url.hostname = `[${ipv6Hosts[0]}]`
    return {
      connectionString: url.toString(),
      fallback: "IPv6 literal fallback used for runtime proof",
    }
  }
}

async function cleanupProofRows(pool: Pool, dealId: string) {
  await pool.query("delete from brik_by_brik_engine.deal_tasks where deal_id = $1", [dealId])
  await pool.query("delete from brik_by_brik_engine.builder_contract_checks where deal_id = $1", [dealId])
  await pool.query("delete from brik_by_brik_engine.builder_proposals where deal_id = $1", [dealId])
  await pool.query("delete from brik_by_brik_engine.manual_overrides where deal_id = $1", [dealId])
  await pool.query("delete from brik_by_brik_engine.risk_flags where deal_id = $1", [dealId])
  await pool.query("delete from brik_by_brik_engine.evidence_items where deal_id = $1", [dealId])
  await pool.query("delete from brik_by_brik_engine.investor_shield_checks where deal_id = $1", [dealId])
  await pool.query("delete from brik_by_brik_engine.saved_deals where id = $1", [dealId])
}

async function main() {
  const normalized = await normalizeConnectionString(readDatabaseUrl())
  process.env.DATABASE_URL = normalized.connectionString

  const [{ createSavedDeal, getSavedDealById }, { POST }] = await Promise.all([
    import("../lib/operator-command/saved-deals-repository"),
    import("../app/api/saved-deals/[id]/pipeline/route"),
  ])

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const proofSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const proofAddress = `Phase4C7D QA ${proofSuffix}`
  const protectedStage = "READY_FOR_OFFER"
  let proofDealId: string | null = null
  let cleanupCompleted = false

  try {
    const savedDeal = await createSavedDeal({
      address: proofAddress,
      listing_url: `https://example.com/phase4c7d/${proofSuffix}`,
      purchase_price: 110000,
      gdv_realistic: 155000,
      refurb_cost: 18000,
      classification: "STRONG_OPPORTUNITY",
      governance_state: "STRONG_OPPORTUNITY",
      capital_protection_state: "PROTECTED",
      pipeline_state: "UNDER_ANALYSIS",
      engine_result_json: { proof: true, phase: "4C-7D", suffix: proofSuffix },
      risk_summary_json: { proof: true },
      next_action: "Runtime proof only",
    })

    proofDealId = savedDeal.id

    const defaultChecksResult = await pool.query(
      `select deal_id, gate_key, status, severity, confidence, required_evidence
       from brik_by_brik_engine.investor_shield_checks
       where deal_id = $1
       order by gate_key asc`,
      [proofDealId]
    )

    const defaultChecksCount = defaultChecksResult.rows.length
    if (defaultChecksCount !== 10) {
      throw new Error(`Expected 10 default checks, found ${defaultChecksCount}`)
    }

    const initialTaskCountResult = await pool.query(
      `select count(*)::int as count
       from brik_by_brik_engine.deal_tasks
       where deal_id = $1`,
      [proofDealId]
    )
    const initialTaskCount = Number(initialTaskCountResult.rows[0]?.count ?? 0)

    const blockedResponse = await POST(
      new Request(`http://localhost/api/saved-deals/${encodeURIComponent(proofDealId)}/pipeline`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requested_pipeline_state: protectedStage }),
      }),
      { params: { id: proofDealId } }
    )

    const blockedPayload = await blockedResponse.json()
    const afterBlockedDeal = await getSavedDealById(proofDealId)

    if (blockedResponse.status !== 409) {
      throw new Error(`Expected blocked attempt status 409, found ${blockedResponse.status}`)
    }

    if (afterBlockedDeal?.pipeline_state !== "UNDER_ANALYSIS") {
      throw new Error("Blocked attempt mutated pipeline state unexpectedly")
    }

    await pool.query(
      `update brik_by_brik_engine.investor_shield_checks
       set status = 'SATISFIED',
           confidence = 'HIGH',
           updated_at = now()
       where deal_id = $1`,
      [proofDealId]
    )

    await pool.query(
      `insert into brik_by_brik_engine.evidence_items (
         id,
         deal_id,
         gate_key,
         evidence_type,
         source,
         label,
         advisory_only
       ) values
         (gen_random_uuid()::text, $1, 'REFURB_CERTAINTY', 'ROOM_MEASUREMENT', 'professional', 'Runtime proof room measurement', false)`,
      [proofDealId]
    )

    const clearResponse = await POST(
      new Request(`http://localhost/api/saved-deals/${encodeURIComponent(proofDealId)}/pipeline`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requested_pipeline_state: protectedStage }),
      }),
      { params: { id: proofDealId } }
    )

    await clearResponse.json()
    const afterClearDeal = await getSavedDealById(proofDealId)

    if (clearResponse.status !== 200) {
      throw new Error(`Expected clear attempt status 200, found ${clearResponse.status}`)
    }

    if (afterClearDeal?.pipeline_state !== protectedStage) {
      throw new Error(`Expected pipeline state ${protectedStage}, found ${afterClearDeal?.pipeline_state ?? "missing"}`)
    }

    const finalTaskCountResult = await pool.query(
      `select count(*)::int as count
       from brik_by_brik_engine.deal_tasks
       where deal_id = $1`,
      [proofDealId]
    )
    const finalTaskCount = Number(finalTaskCountResult.rows[0]?.count ?? 0)

    if (finalTaskCount !== initialTaskCount) {
      throw new Error(`Expected deal_tasks count to remain ${initialTaskCount}, found ${finalTaskCount}`)
    }

    await cleanupProofRows(pool, proofDealId)
    cleanupCompleted = true

    console.log(
      JSON.stringify(
        {
          result: "PASS",
          proofDealId,
          cleanupCompleted,
          protectedStageTested: protectedStage,
          defaultChecksCount,
          blockedAttempt: {
            status: blockedResponse.status,
            movementDecision: blockedPayload?.guard?.investor_shield?.movementDecision ?? null,
            pipelineStateAfterAttempt: afterBlockedDeal?.pipeline_state ?? null,
          },
          clearAttempt: {
            status: clearResponse.status,
            pipelineStateAfterAttempt: afterClearDeal?.pipeline_state ?? null,
          },
          dealTasksCount: {
            beforeRouteProof: initialTaskCount,
            afterRouteProof: finalTaskCount,
          },
          noTaskPersistenceFromRoute: finalTaskCount === initialTaskCount,
          connectionFallback: normalized.fallback,
        },
        null,
        2
      )
    )
  } catch (error) {
    if (proofDealId) {
      await cleanupProofRows(pool, proofDealId)
      cleanupCompleted = true
    }

    console.error(
      JSON.stringify(
        {
          result: "FAIL",
          proofDealId,
          cleanupCompleted,
          error: error instanceof Error ? error.message : String(error),
          connectionFallback: normalized.fallback,
        },
        null,
        2
      )
    )
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

void main()
