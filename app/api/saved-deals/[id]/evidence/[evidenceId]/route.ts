import { NextResponse } from "next/server"
import { createSafeRouteErrorDiagnostic } from "@/lib/http/safe-route-error"
import { getSavedDealById } from "@/lib/operator-command/saved-deals-repository"
import {
  getEvidenceLiteById,
  updateEvidenceLite,
} from "@/lib/evidence-lite/evidence-lite-repository"
import {
  validateEvidenceCommandInput,
  validateUpdateEvidenceLiteInput,
} from "@/lib/evidence-lite/evidence-lite-validation"
import {
  EVIDENCE_LITE_EVIDENCE_TYPES,
  type EvidenceLiteEvidenceType,
  type NormalizedEvidenceCommandInput,
} from "@/types/evidence-lite"

type RouteContext = {
  params: Promise<{ id?: string; evidenceId?: string }> | { id?: string; evidenceId?: string }
}

const SAFE_INVALID_DEAL_ID = "Invalid saved deal id."
const SAFE_INVALID_EVIDENCE_ID = "Invalid evidence id."
const SAFE_NOT_FOUND = "Saved deal not found."
const SAFE_EVIDENCE_NOT_FOUND = "Evidence record not found."
const SAFE_INVALID_JSON = "Malformed JSON."
const SAFE_INVALID_INPUT = "Invalid evidence input."
const SAFE_UPDATE_ERROR = "EVIDENCE_LITE_UPDATE_FAILED"
const EVIDENCE_LITE_EVIDENCE_TYPE_SET = new Set(EVIDENCE_LITE_EVIDENCE_TYPES)
const EVIDENCE_COMMAND_FIELDS = new Set([
  "linkedInvestorShieldGate",
  "linkedProfessionalGate",
  "evidenceSummary",
  "evidenceStatus",
  "evidenceStrength",
  "reviewState",
  "blockerImpact",
  "recommendedNextAction",
  "expiryOrUpdateDate",
  "source",
  "mobileCaptureNote",
])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function buildValidationError(
  field: string,
  message: string
): {
  errors: Array<{ field: string; message: string }>
  warnings: string[]
} {
  return {
    errors: [{ field, message }],
    warnings: [],
  }
}

function isEvidenceCommandPayload(body: Record<string, unknown>): boolean {
  for (const field of EVIDENCE_COMMAND_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      return true
    }
  }

  const evidenceType = body.evidenceType
  return (
    typeof evidenceType === "string" &&
    !EVIDENCE_LITE_EVIDENCE_TYPE_SET.has(evidenceType as EvidenceLiteEvidenceType)
  )
}

function buildCurrentCommandInput(
  evidence: NonNullable<Awaited<ReturnType<typeof getEvidenceLiteById>>>
): NormalizedEvidenceCommandInput {
  return {
    evidenceType: evidence.evidenceCommandType,
    linkedInvestorShieldGate: evidence.linkedInvestorShieldGate,
    linkedProfessionalGate: evidence.linkedProfessionalGate,
    title: evidence.title,
    evidenceSummary: evidence.evidenceSummary,
    evidenceStatus: evidence.evidenceStatus,
    evidenceStrength: evidence.evidenceStrength,
    reviewState: evidence.reviewState,
    blockerImpact: evidence.blockerImpact,
    recommendedNextAction: evidence.recommendedNextAction,
    expiryOrUpdateDate: evidence.expiryOrUpdateDate,
    source: evidence.source,
    mobileCaptureNote: evidence.mobileCaptureNote,
  }
}

function buildCommandPatchInput(
  body: Record<string, unknown>,
  value: NormalizedEvidenceCommandInput
): Partial<NormalizedEvidenceCommandInput> {
  const update: Partial<NormalizedEvidenceCommandInput> = {}

  if (Object.prototype.hasOwnProperty.call(body, "evidenceType")) {
    update.evidenceType = value.evidenceType
  }
  if (Object.prototype.hasOwnProperty.call(body, "linkedInvestorShieldGate")) {
    update.linkedInvestorShieldGate = value.linkedInvestorShieldGate
  }
  if (Object.prototype.hasOwnProperty.call(body, "linkedProfessionalGate")) {
    update.linkedProfessionalGate = value.linkedProfessionalGate
  }
  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    update.title = value.title
  }
  if (Object.prototype.hasOwnProperty.call(body, "evidenceSummary")) {
    update.evidenceSummary = value.evidenceSummary
  }
  if (Object.prototype.hasOwnProperty.call(body, "evidenceStatus")) {
    update.evidenceStatus = value.evidenceStatus
  }
  if (Object.prototype.hasOwnProperty.call(body, "evidenceStrength")) {
    update.evidenceStrength = value.evidenceStrength
  }
  if (Object.prototype.hasOwnProperty.call(body, "reviewState")) {
    update.reviewState = value.reviewState
  }
  if (Object.prototype.hasOwnProperty.call(body, "blockerImpact")) {
    update.blockerImpact = value.blockerImpact
  }
  if (Object.prototype.hasOwnProperty.call(body, "recommendedNextAction")) {
    update.recommendedNextAction = value.recommendedNextAction
  }
  if (Object.prototype.hasOwnProperty.call(body, "expiryOrUpdateDate")) {
    update.expiryOrUpdateDate = value.expiryOrUpdateDate
  }
  if (Object.prototype.hasOwnProperty.call(body, "source")) {
    update.source = value.source
  }
  if (Object.prototype.hasOwnProperty.call(body, "mobileCaptureNote")) {
    update.mobileCaptureNote = value.mobileCaptureNote
  }

  return update
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const params = await context.params
    const dealId = params?.id?.trim()
    const evidenceId = params?.evidenceId?.trim()

    if (!dealId) {
      return NextResponse.json({ success: false, error: SAFE_INVALID_DEAL_ID }, { status: 400 })
    }

    if (!evidenceId) {
      return NextResponse.json({ success: false, error: SAFE_INVALID_EVIDENCE_ID }, { status: 400 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: SAFE_INVALID_JSON }, { status: 400 })
    }

    if (!isPlainObject(body)) {
      return NextResponse.json(
        {
          success: false,
          error: SAFE_INVALID_INPUT,
          validation: buildValidationError("root", "body must be a JSON object"),
        },
        { status: 400 }
      )
    }

    if (Object.prototype.hasOwnProperty.call(body, "dealId")) {
      return NextResponse.json(
        {
          success: false,
          error: SAFE_INVALID_INPUT,
          validation: buildValidationError(
            "dealId",
            "dealId is supplied by the route and must not be included in the body"
          ),
        },
        { status: 400 }
      )
    }

    const useCommandValidation = isEvidenceCommandPayload(body)

    if (useCommandValidation) {
      const deal = await getSavedDealById(dealId)
      if (!deal) {
        return NextResponse.json({ success: false, error: SAFE_NOT_FOUND }, { status: 404 })
      }

      const evidence = await getEvidenceLiteById(dealId, evidenceId)
      if (!evidence) {
        return NextResponse.json({ success: false, error: SAFE_EVIDENCE_NOT_FOUND }, { status: 404 })
      }

      const validation = validateEvidenceCommandInput({
        ...buildCurrentCommandInput(evidence),
        ...body,
      })
      if (!validation.valid || !validation.value) {
        return NextResponse.json(
          {
            success: false,
            error: SAFE_INVALID_INPUT,
            validation: {
              errors: validation.errors,
              warnings: validation.warnings,
            },
          },
          { status: 400 }
        )
      }

      const updatedEvidence = await updateEvidenceLite(
        dealId,
        evidenceId,
        buildCommandPatchInput(body, validation.value)
      )

      if (!updatedEvidence) {
        return NextResponse.json({ success: false, error: SAFE_EVIDENCE_NOT_FOUND }, { status: 404 })
      }

      return NextResponse.json({ success: true, evidence: updatedEvidence }, { status: 200 })
    }

    const validation = validateUpdateEvidenceLiteInput(body)
    if (!validation.valid || !validation.value) {
      return NextResponse.json(
        {
          success: false,
          error: SAFE_INVALID_INPUT,
          validation: {
            errors: validation.errors,
            warnings: validation.warnings,
          },
        },
        { status: 400 }
      )
    }

    const deal = await getSavedDealById(dealId)
    if (!deal) {
      return NextResponse.json({ success: false, error: SAFE_NOT_FOUND }, { status: 404 })
    }

    const evidence = await getEvidenceLiteById(dealId, evidenceId)
    if (!evidence) {
      return NextResponse.json({ success: false, error: SAFE_EVIDENCE_NOT_FOUND }, { status: 404 })
    }

    const updatedEvidence = await updateEvidenceLite(dealId, evidenceId, validation.value)
    if (!updatedEvidence) {
      return NextResponse.json({ success: false, error: SAFE_EVIDENCE_NOT_FOUND }, { status: 404 })
    }

    return NextResponse.json({ success: true, evidence: updatedEvidence }, { status: 200 })
  } catch (error) {
    const diagnostic = createSafeRouteErrorDiagnostic("saved-deals.evidence.item", error)
    console.error("Evidence Lite item update failed.", diagnostic)

    return NextResponse.json(
      {
        success: false,
        error: SAFE_UPDATE_ERROR,
        traceId: diagnostic.traceId,
        diagnostic,
      },
      { status: 500 }
    )
  }
}
