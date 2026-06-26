import { NextResponse } from "next/server"
import { createSafeRouteErrorDiagnostic } from "@/lib/http/safe-route-error"
import { getSavedDealById } from "@/lib/operator-command/saved-deals-repository"
import {
  getEvidenceLiteById,
  updateEvidenceLite,
} from "@/lib/evidence-lite/evidence-lite-repository"
import { validateUpdateEvidenceLiteInput } from "@/lib/evidence-lite/evidence-lite-validation"

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
