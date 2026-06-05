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

async function main() {
  const normalized = await normalizeConnectionString(readDatabaseUrl())
  process.env.DATABASE_URL = normalized.connectionString

  const [
    { createSavedDeal },
    { INVESTOR_SHIELD_DEFAULT_GATES },
  ] = await Promise.all([
    import("../lib/operator-command/saved-deals-repository"),
    import("../lib/investor-shield/default-gates"),
  ])

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const proofSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const proofAddress = `Phase4B7 QA ${proofSuffix}`
  let proofDealId: string | null = null
  let cleanupCompleted = false

  try {
    const savedDeal = await createSavedDeal({
      address: proofAddress,
      listing_url: `https://example.com/phase4b7/${proofSuffix}`,
      purchase_price: 100000,
      gdv_realistic: 145000,
      refurb_cost: 20000,
      classification: "CONDITIONAL",
      governance_state: "MANUAL_REVIEW_REQUIRED",
      capital_protection_state: "PROTECTED",
      pipeline_state: "UNDER_ANALYSIS",
      engine_result_json: { proof: true, phase: "4B-7", suffix: proofSuffix },
      risk_summary_json: { proof: true },
      next_action: "Runtime proof only",
    })

    proofDealId = savedDeal.id

    const schemaResult = await pool.query(
      `select table_schema, table_name
       from information_schema.tables
       where table_schema = 'brik_by_brik_engine'
         and table_name in ('saved_deals', 'investor_shield_checks')
       order by table_name`
    )

    const idTypeResult = await pool.query(
      `select table_name, column_name, data_type
       from information_schema.columns
       where table_schema = 'brik_by_brik_engine'
         and ((table_name = 'saved_deals' and column_name = 'id')
           or (table_name = 'investor_shield_checks' and column_name = 'deal_id'))
       order by table_name, column_name`
    )

    const checksResult = await pool.query(
      `select deal_id, gate_key, status, severity, confidence, required_evidence
       from brik_by_brik_engine.investor_shield_checks
       where deal_id = $1
       order by gate_key asc`,
      [proofDealId]
    )

    const checks = checksResult.rows
    const expectedGates = INVESTOR_SHIELD_DEFAULT_GATES.map((gate) => ({
      key: gate.key,
      severity: gate.defaultSeverity,
      evidenceTypes: gate.evidenceTypes,
    }))

    if (checks.length !== expectedGates.length) {
      throw new Error(`Expected ${expectedGates.length} checks, found ${checks.length}`)
    }

    for (const gate of expectedGates) {
      const row = checks.find((item) => item.gate_key === gate.key)
      if (!row) {
        throw new Error(`Missing gate ${gate.key}`)
      }
      if (row.deal_id !== proofDealId) {
        throw new Error(`Gate ${gate.key} has mismatched deal_id`)
      }
      if (row.status !== "REQUIRED") {
        throw new Error(`Gate ${gate.key} has unexpected status ${row.status}`)
      }
      if (row.confidence !== "UNKNOWN") {
        throw new Error(`Gate ${gate.key} has unexpected confidence ${row.confidence}`)
      }
      if (row.severity !== gate.severity) {
        throw new Error(`Gate ${gate.key} has unexpected severity ${row.severity}`)
      }
      if (!Array.isArray(row.required_evidence) || row.required_evidence.length === 0) {
        throw new Error(`Gate ${gate.key} has empty required_evidence`)
      }
    }

    await pool.query("delete from brik_by_brik_engine.investor_shield_checks where deal_id = $1", [proofDealId])
    await pool.query("delete from brik_by_brik_engine.saved_deals where id = $1", [proofDealId])
    cleanupCompleted = true

    console.log(
      JSON.stringify(
        {
          result: "PASS",
          proofDealId,
          cleanupCompleted,
          checksCreated: checks.length,
          gateKeysVerified: checks.map((row) => row.gate_key),
          runtimeSchemaTables: schemaResult.rows,
          idTypes: idTypeResult.rows,
          nonBlockingBehavior:
            "Saved deal creation completed through the repository path; default check creation ran as a best-effort side effect without enforcement logic.",
          connectionFallback: normalized.fallback,
        },
        null,
        2
      )
    )
  } catch (error) {
    if (proofDealId) {
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
