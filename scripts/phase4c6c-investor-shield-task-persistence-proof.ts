import fs from "node:fs"
import path from "node:path"
import dns from "node:dns/promises"
import { Pool } from "pg"
import type { InvestorShieldEnforcementResult } from "../types/investor-shield-enforcement"

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

function buildProofResult(dealId: string): InvestorShieldEnforcementResult {
  return {
    dealId,
    overallStatus: "BLOCKED",
    progressionDecision: "BLOCKED",
    canProgress: false,
    blockingGateKeys: ["TITLE", "REFURB_CERTAINTY"],
    cautionGateKeys: [],
    missingEvidenceGateKeys: ["TITLE", "REFURB_CERTAINTY"],
    manualOverrideRequired: false,
    advisoryOnlyEvidenceWarnings: [],
    blockingReasons: ["REQUIRED_GATE_MISSING"],
    deterministicDominanceNote: undefined,
    evaluatedAt: new Date().toISOString(),
    taskRecommendations: [
      {
        gateKey: "TITLE",
        type: "REVIEW_GATE",
        title: "Review title pack and restrictions",
        reason: "Title evidence is incomplete and requires manual review.",
        severity: "BLOCKER",
        source: "system_default",
        idempotencyKey: `investor-shield:${dealId}:TITLE:review-title`,
      },
      {
        gateKey: "REFURB_CERTAINTY",
        subGateKey: "BUILDER_QUOTE_EVIDENCE",
        type: "OBTAIN_BUILDER_QUOTE",
        title: "Obtain builder quote evidence",
        reason: "Refurb certainty is missing a hard builder quote.",
        severity: "BLOCKER",
        source: "document",
        idempotencyKey: `investor-shield:${dealId}:REFURB_CERTAINTY:BUILDER_QUOTE_EVIDENCE:builder-quote`,
      },
    ],
  }
}

async function main() {
  const normalized = await normalizeConnectionString(readDatabaseUrl())
  process.env.DATABASE_URL = normalized.connectionString

  const [
    { createSavedDeal },
    { buildInvestorShieldTaskDrafts },
    { persistInvestorShieldTaskDrafts },
  ] = await Promise.all([
    import("../lib/operator-command/saved-deals-repository"),
    import("../lib/investor-shield/build-investor-shield-task-drafts"),
    import("../lib/investor-shield/persist-investor-shield-task-drafts"),
  ])

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const proofSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const proofAddress = `Phase4C6C QA ${proofSuffix}`
  let proofDealId: string | null = null
  let cleanupCompleted = false

  try {
    const savedDeal = await createSavedDeal({
      address: proofAddress,
      listing_url: `https://example.com/phase4c6c/${proofSuffix}`,
      purchase_price: 120000,
      gdv_realistic: 170000,
      refurb_cost: 25000,
      classification: "CONDITIONAL",
      governance_state: "MANUAL_REVIEW_REQUIRED",
      capital_protection_state: "PROTECTED",
      pipeline_state: "UNDER_ANALYSIS",
      engine_result_json: { proof: true, phase: "4C-6C", suffix: proofSuffix },
      risk_summary_json: { proof: true },
      next_action: "Runtime proof only",
    })

    proofDealId = savedDeal.id

    const proofResult = buildProofResult(proofDealId)
    const drafts = buildInvestorShieldTaskDrafts(proofResult)

    if (drafts.length === 0) {
      throw new Error("Expected non-empty task drafts")
    }

    const firstRun = await persistInvestorShieldTaskDrafts(proofDealId, drafts)
    const firstQuery = await pool.query(
      `select id, deal_id, task_title, task_status, priority, blocker_reason
       from brik_by_brik_engine.deal_tasks
       where deal_id = $1
       order by created_at asc`,
      [proofDealId]
    )

    if (firstRun.failedCount !== 0) {
      throw new Error(`First persistence run failed for ${firstRun.failedCount} drafts`)
    }

    if (firstRun.insertedCount !== drafts.length) {
      throw new Error(`Expected ${drafts.length} inserts on first run, found ${firstRun.insertedCount}`)
    }

    if (firstQuery.rows.length !== drafts.length) {
      throw new Error(`Expected ${drafts.length} persisted tasks, found ${firstQuery.rows.length}`)
    }

    for (const row of firstQuery.rows) {
      if (row.deal_id !== proofDealId) {
        throw new Error(`Persisted task ${row.id} has mismatched deal_id`)
      }
      if (typeof row.blocker_reason !== "string" || !row.blocker_reason.includes("Investor Shield ID:")) {
        throw new Error(`Persisted task ${row.id} is missing Investor Shield marker`)
      }
    }

    const secondRun = await persistInvestorShieldTaskDrafts(proofDealId, drafts)
    const secondQuery = await pool.query(
      `select id, deal_id, task_title, task_status, priority, blocker_reason
       from brik_by_brik_engine.deal_tasks
       where deal_id = $1
       order by created_at asc`,
      [proofDealId]
    )

    if (secondRun.failedCount !== 0) {
      throw new Error(`Second persistence run failed for ${secondRun.failedCount} drafts`)
    }

    if (secondRun.insertedCount !== 0) {
      throw new Error(`Expected 0 inserts on second run, found ${secondRun.insertedCount}`)
    }

    if (secondRun.skippedDuplicateCount !== drafts.length) {
      throw new Error(
        `Expected ${drafts.length} duplicates skipped on second run, found ${secondRun.skippedDuplicateCount}`
      )
    }

    if (secondQuery.rows.length !== drafts.length) {
      throw new Error(`Expected ${drafts.length} total tasks after second run, found ${secondQuery.rows.length}`)
    }

    await pool.query("delete from brik_by_brik_engine.deal_tasks where deal_id = $1", [proofDealId])
    await pool.query("delete from brik_by_brik_engine.investor_shield_checks where deal_id = $1", [proofDealId])
    await pool.query("delete from brik_by_brik_engine.saved_deals where id = $1", [proofDealId])
    cleanupCompleted = true

    console.log(
      JSON.stringify(
        {
          result: "PASS",
          proofDealId,
          cleanupCompleted,
          draftsBuilt: drafts.length,
          gateKeysVerified: drafts.map((draft) => draft.gateKey),
          firstRun,
          secondRun,
          finalTaskCount: secondQuery.rows.length,
          taskMarkerVerified: true,
          idempotencyVerified: true,
          nonBlockingBehavior:
            "Task persistence proof ran separately from saved-deal creation flow; repeated persistence skipped duplicates without pipeline enforcement or movement blocking.",
          connectionFallback: normalized.fallback,
        },
        null,
        2
      )
    )
  } catch (error) {
    if (proofDealId) {
      await pool.query("delete from brik_by_brik_engine.deal_tasks where deal_id = $1", [proofDealId])
      await pool.query("delete from brik_by_brik_engine.investor_shield_checks where deal_id = $1", [proofDealId])
      await pool.query("delete from brik_by_brik_engine.saved_deals where id = $1", [proofDealId])
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
