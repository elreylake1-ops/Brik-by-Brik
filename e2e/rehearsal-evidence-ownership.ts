export type RehearsalEvidenceResponse = {
  id?: unknown
  assessmentId?: unknown
  assessment_id?: unknown
  dealId?: unknown
  deal_id?: unknown
}

export type PersistedEvidenceOwnership = {
  id: string
  assessmentId: string
  dealId: string
}

export async function verifyRehearsalEvidenceOwnership(
  records: readonly RehearsalEvidenceResponse[],
  expectedDealId: string,
  expectedAssessmentId: string,
  lookup: (ids: readonly string[]) => Promise<readonly PersistedEvidenceOwnership[]>
): Promise<string[]> {
  const ids = records.map((record) => record.id)
  if (!ids.every((id): id is string => typeof id === "string" && id.length > 0)) {
    throw new Error("Rehearsal evidence response returned a missing authoritative ID")
  }
  if (new Set(ids).size !== ids.length) throw new Error("Rehearsal evidence response returned duplicate IDs")

  for (const record of records) {
    const responseAssessmentId = record.assessmentId ?? record.assessment_id
    const responseDealId = record.dealId ?? record.deal_id
    if (responseAssessmentId !== undefined && responseAssessmentId !== expectedAssessmentId) {
      throw new Error(`Rehearsal evidence response returned mismatched assessment ownership for ${record.id}`)
    }
    if (responseDealId !== undefined && responseDealId !== expectedDealId) {
      throw new Error(`Rehearsal evidence response returned mismatched deal ownership for ${record.id}`)
    }
  }

  const persisted = await lookup(ids)
  if (persisted.length !== ids.length || new Set(persisted.map((row) => row.id)).size !== ids.length) {
    throw new Error("Rehearsal evidence ownership lookup was missing or ambiguous")
  }
  const byId = new Map(persisted.map((row) => [row.id, row]))
  for (const id of ids) {
    const row = byId.get(id)
    if (!row || row.assessmentId !== expectedAssessmentId || row.dealId !== expectedDealId) {
      throw new Error(`Rehearsal evidence persisted ownership mismatch for ${id}`)
    }
  }
  return ids
}
