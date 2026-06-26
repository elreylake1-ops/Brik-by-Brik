import { randomUUID } from "node:crypto"
import { query } from "@/lib/db/postgres"
import {
  EVIDENCE_LITE_EVIDENCE_TYPES,
  EVIDENCE_LITE_GATES,
  EVIDENCE_LITE_STATUSES,
  type EvidenceLiteRecord,
  type NormalizedCreateEvidenceLiteInput,
  type NormalizedUpdateEvidenceLiteInput,
} from "@/types/evidence-lite"

const EVIDENCE_LITE_FIELDS =
  "id, deal_id, evidence_type, linked_gate, title, note, status, reviewed, created_at, updated_at"

type EvidenceLiteDbRow = {
  id: string
  deal_id: string
  evidence_type: string
  linked_gate: string
  title: string
  note: string
  status: string
  reviewed: boolean
  created_at: string
  updated_at: string
}

const EVIDENCE_LITE_EVIDENCE_TYPE_SET = new Set<string>(EVIDENCE_LITE_EVIDENCE_TYPES)
const EVIDENCE_LITE_GATE_SET = new Set<string>(EVIDENCE_LITE_GATES)
const EVIDENCE_LITE_STATUS_SET = new Set<string>(EVIDENCE_LITE_STATUSES)
const EVIDENCE_LITE_UPDATE_FIELDS = [
  ["evidence_type", "evidenceType"],
  ["linked_gate", "linkedGate"],
  ["title", "title"],
  ["note", "note"],
  ["status", "status"],
  ["reviewed", "reviewed"],
] as const

function generateEvidenceLiteId(): string {
  return `evidence_${randomUUID()}`
}

function assertCanonicalEvidenceLiteValue(
  field: "evidence_type" | "linked_gate" | "status",
  value: string
): void {
  if (field === "linked_gate" && value === "SOLICITOR_FEEDBACK") {
    throw new Error("Legacy solicitor feedback value must not be stored: linked_gate")
  }

  if (field === "linked_gate" && value === "GENERAL") {
    throw new Error("Invalid Evidence Lite value must not be stored: linked_gate")
  }

  if (field === "evidence_type" && !EVIDENCE_LITE_EVIDENCE_TYPE_SET.has(value)) {
    throw new Error(`Invalid stored Evidence Lite evidence_type: ${value}`)
  }

  if (field === "linked_gate" && !EVIDENCE_LITE_GATE_SET.has(value)) {
    throw new Error(`Invalid stored Evidence Lite linked_gate: ${value}`)
  }

  if (field === "status" && !EVIDENCE_LITE_STATUS_SET.has(value)) {
    throw new Error(`Invalid stored Evidence Lite status: ${value}`)
  }

  if (value === "SOLICITOR_FEEDBACK") {
    throw new Error(`Legacy solicitor feedback value must not be stored: ${field}`)
  }

  if (value === "GENERAL") {
    throw new Error(`Invalid Evidence Lite value must not be stored: ${field}`)
  }
}

function mapEvidenceLiteRow(row: EvidenceLiteDbRow): EvidenceLiteRecord {
  assertCanonicalEvidenceLiteValue("evidence_type", row.evidence_type)
  assertCanonicalEvidenceLiteValue("linked_gate", row.linked_gate)
  assertCanonicalEvidenceLiteValue("status", row.status)

  return {
    id: row.id,
    dealId: row.deal_id,
    evidenceType: row.evidence_type as EvidenceLiteRecord["evidenceType"],
    linkedGate: row.linked_gate as EvidenceLiteRecord["linkedGate"],
    title: row.title,
    note: row.note,
    status: row.status as EvidenceLiteRecord["status"],
    reviewed: row.reviewed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function buildUpdateAssignments(input: NormalizedUpdateEvidenceLiteInput): {
  assignments: string[]
  values: unknown[]
} {
  const assignments: string[] = []
  const values: unknown[] = []

  for (const [sqlField, inputField] of EVIDENCE_LITE_UPDATE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, inputField)) {
      const value = input[inputField]
      values.push(value)
      assignments.push(`${sqlField} = $${values.length}`)
    }
  }

  assignments.push("updated_at = NOW()")

  return { assignments, values }
}

export async function listEvidenceLiteForDeal(dealId: string): Promise<EvidenceLiteRecord[]> {
  const result = await query<EvidenceLiteDbRow>(
    `SELECT ${EVIDENCE_LITE_FIELDS}
     FROM brik_by_brik_engine.deal_evidence
     WHERE deal_id = $1
     ORDER BY created_at DESC, id DESC`,
    [dealId]
  )

  return result.rows.map(mapEvidenceLiteRow)
}

export async function getEvidenceLiteById(
  dealId: string,
  evidenceId: string
): Promise<EvidenceLiteRecord | null> {
  const result = await query<EvidenceLiteDbRow>(
    `SELECT ${EVIDENCE_LITE_FIELDS}
     FROM brik_by_brik_engine.deal_evidence
     WHERE deal_id = $1
       AND id = $2
     LIMIT 1`,
    [dealId, evidenceId]
  )

  const row = result.rows[0]
  return row ? mapEvidenceLiteRow(row) : null
}

export async function createEvidenceLite(
  input: NormalizedCreateEvidenceLiteInput
): Promise<EvidenceLiteRecord> {
  const id = generateEvidenceLiteId()
  const result = await query<EvidenceLiteDbRow>(
    `INSERT INTO brik_by_brik_engine.deal_evidence (
      id,
      deal_id,
      evidence_type,
      linked_gate,
      title,
      note,
      status,
      reviewed
    ) VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8
    ) RETURNING ${EVIDENCE_LITE_FIELDS}`,
    [
      id,
      input.dealId,
      input.evidenceType,
      input.linkedGate,
      input.title,
      input.note,
      input.status,
      input.reviewed,
    ]
  )

  const row = result.rows[0]
  if (!row) {
    throw new Error("Evidence Lite create returned no row")
  }

  return mapEvidenceLiteRow(row)
}

export async function updateEvidenceLite(
  dealId: string,
  evidenceId: string,
  input: NormalizedUpdateEvidenceLiteInput
): Promise<EvidenceLiteRecord | null> {
  const { assignments, values } = buildUpdateAssignments(input)
  values.push(dealId)
  values.push(evidenceId)

  const result = await query<EvidenceLiteDbRow>(
    `UPDATE brik_by_brik_engine.deal_evidence
     SET ${assignments.join(", ")}
     WHERE deal_id = $${values.length - 1}
       AND id = $${values.length}
     RETURNING ${EVIDENCE_LITE_FIELDS}`,
    values
  )

  const row = result.rows[0]
  return row ? mapEvidenceLiteRow(row) : null
}

export { mapEvidenceLiteRow }
