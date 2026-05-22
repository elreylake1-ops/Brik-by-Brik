import { query } from "@/lib/db/postgres"

const SAVED_DEAL_FIELDS =
  "id, created_at, updated_at, archived_at, address, listing_url, purchase_price, gdv_realistic, refurb_cost, classification, governance_state, capital_protection_state, pipeline_state, engine_result_json, risk_summary_json, next_action"

type SavedDealRecord = {
  id: string
  created_at: string
  updated_at: string
  archived_at: string | null
  address: string
  listing_url: string | null
  purchase_price: number | null
  gdv_realistic: number | null
  refurb_cost: number | null
  classification: string
  governance_state: string
  capital_protection_state: string
  pipeline_state: string
  engine_result_json: Record<string, unknown>
  risk_summary_json: Record<string, unknown>
  next_action: string | null
}

export type CreateSavedDealInput = {
  id?: string
  created_at?: string
  updated_at?: string
  address: string
  listing_url?: string | null
  purchase_price?: number | null
  gdv_realistic?: number | null
  refurb_cost?: number | null
  classification: string
  governance_state: string
  capital_protection_state: string
  pipeline_state: string
  engine_result_json: Record<string, unknown>
  risk_summary_json: Record<string, unknown>
  next_action?: string | null
}

export type ListSavedDealsOptions = {
  includeArchived?: boolean
  limit?: number
  offset?: number
}

export type UpdateSavedDealPatch = Partial<
  Pick<
    SavedDealRecord,
    | "address"
    | "listing_url"
    | "purchase_price"
    | "gdv_realistic"
    | "refurb_cost"
    | "classification"
    | "governance_state"
    | "capital_protection_state"
    | "pipeline_state"
    | "engine_result_json"
    | "risk_summary_json"
    | "next_action"
    | "updated_at"
  >
>

export async function createSavedDeal(input: CreateSavedDealInput): Promise<SavedDealRecord> {
  const result = await query<SavedDealRecord>(
    `INSERT INTO saved_deals (
      id,
      created_at,
      updated_at,
      archived_at,
      address,
      listing_url,
      purchase_price,
      gdv_realistic,
      refurb_cost,
      classification,
      governance_state,
      capital_protection_state,
      pipeline_state,
      engine_result_json,
      risk_summary_json,
      next_action
    ) VALUES (
      COALESCE($1, gen_random_uuid()::text),
      COALESCE($2::timestamptz, NOW()),
      COALESCE($3::timestamptz, NOW()),
      NULL,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11,
      $12,
      $13::jsonb,
      $14::jsonb,
      $15
    ) RETURNING ${SAVED_DEAL_FIELDS}`,
    [
      input.id ?? null,
      input.created_at ?? null,
      input.updated_at ?? null,
      input.address,
      input.listing_url ?? null,
      input.purchase_price ?? null,
      input.gdv_realistic ?? null,
      input.refurb_cost ?? null,
      input.classification,
      input.governance_state,
      input.capital_protection_state,
      input.pipeline_state,
      input.engine_result_json,
      input.risk_summary_json,
      input.next_action ?? null,
    ]
  )

  return result.rows[0]
}

export async function getSavedDealById(id: string): Promise<SavedDealRecord | null> {
  const result = await query<SavedDealRecord>(
    `SELECT ${SAVED_DEAL_FIELDS}
     FROM saved_deals
     WHERE id = $1
     LIMIT 1`,
    [id]
  )

  return result.rows[0] ?? null
}

export async function listSavedDeals(options: ListSavedDealsOptions = {}): Promise<SavedDealRecord[]> {
  const includeArchived = options.includeArchived ?? false
  const limit = options.limit ?? 100
  const offset = options.offset ?? 0

  const whereClause = includeArchived ? "" : "WHERE archived_at IS NULL"

  const result = await query<SavedDealRecord>(
    `SELECT ${SAVED_DEAL_FIELDS}
     FROM saved_deals
     ${whereClause}
     ORDER BY updated_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  )

  return result.rows
}

export async function updateSavedDeal(id: string, patch: UpdateSavedDealPatch): Promise<SavedDealRecord | null> {
  const allowedKeys: Array<keyof UpdateSavedDealPatch> = [
    "address",
    "listing_url",
    "purchase_price",
    "gdv_realistic",
    "refurb_cost",
    "classification",
    "governance_state",
    "capital_protection_state",
    "pipeline_state",
    "engine_result_json",
    "risk_summary_json",
    "next_action",
  ]

  const assignments: string[] = []
  const values: unknown[] = []

  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      values.push(patch[key] ?? null)
      const index = values.length
      if (key === "engine_result_json" || key === "risk_summary_json") {
        assignments.push(`${key} = $${index}::jsonb`)
      } else {
        assignments.push(`${key} = $${index}`)
      }
    }
  }

  values.push(patch.updated_at ?? null)
  const updatedAtIndex = values.length
  assignments.push(`updated_at = COALESCE($${updatedAtIndex}::timestamptz, NOW())`)

  values.push(id)
  const idIndex = values.length

  const result = await query<SavedDealRecord>(
    `UPDATE saved_deals
     SET ${assignments.join(", ")}
     WHERE id = $${idIndex}
     RETURNING ${SAVED_DEAL_FIELDS}`,
    values
  )

  return result.rows[0] ?? null
}

export async function archiveSavedDeal(id: string): Promise<SavedDealRecord | null> {
  const result = await query<SavedDealRecord>(
    `UPDATE saved_deals
     SET archived_at = NOW(),
         pipeline_state = 'ARCHIVED',
         updated_at = NOW()
     WHERE id = $1
     RETURNING ${SAVED_DEAL_FIELDS}`,
    [id]
  )

  return result.rows[0] ?? null
}
