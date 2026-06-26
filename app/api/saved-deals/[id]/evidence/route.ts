import { NextResponse } from "next/server"
import { createSafeRouteErrorDiagnostic } from "@/lib/http/safe-route-error"
import { getSavedDealById } from "@/lib/operator-command/saved-deals-repository"
import {
  createEvidenceLite,
  listEvidenceLiteForDeal,
} from "@/lib/evidence-lite/evidence-lite-repository"
import { validateCreateEvidenceLiteInput } from "@/lib/evidence-lite/evidence-lite-validation"

type RouteContext = {
  params: Promise<{ id?: string }> | { id?: string }
}

const SAFE_INVALID_ID = "Invalid saved deal id."
const SAFE_NOT_FOUND = "Saved deal not found."
const SAFE_INVALID_JSON = "Malformed JSON."
const SAFE_INVALID_INPUT = "Invalid evidence input."
const SAFE_READ_ERROR = "EVIDENCE_LITE_READ_FAILED"
const SAFE_CREATE_ERROR = "EVIDENCE_LITE_CREATE_FAILED"

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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const params = await context.params
    const id = params?.id?.trim()

    if (!id) {
      return NextResponse.json({ success: false, error: SAFE_INVALID_ID }, { status: 400 })
    }

    const deal = await getSavedDealById(id)
    if (!deal) {
      return NextResponse.json({ success: false, error: SAFE_NOT_FOUND }, { status: 404 })
    }

    const evidence = await listEvidenceLiteForDeal(id)

    return NextResponse.json({ success: true, evidence }, { status: 200 })
  } catch (error) {
    const diagnostic = createSafeRouteErrorDiagnostic("saved-deals.evidence", error)
    console.error("Evidence Lite list failed.", diagnostic)

    return NextResponse.json(
      {
        success: false,
        error: SAFE_READ_ERROR,
        traceId: diagnostic.traceId,
        diagnostic,
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = await context.params
    const id = params?.id?.trim()

    if (!id) {
      return NextResponse.json({ success: false, error: SAFE_INVALID_ID }, { status: 400 })
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

    const deal = await getSavedDealById(id)
    if (!deal) {
      return NextResponse.json({ success: false, error: SAFE_NOT_FOUND }, { status: 404 })
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

    const validation = validateCreateEvidenceLiteInput({
      ...body,
      dealId: id,
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

    const evidence = await createEvidenceLite(validation.value)

    return NextResponse.json({ success: true, evidence }, { status: 201 })
  } catch (error) {
    const diagnostic = createSafeRouteErrorDiagnostic("saved-deals.evidence", error)
    console.error("Evidence Lite create failed.", diagnostic)

    return NextResponse.json(
      {
        success: false,
        error: SAFE_CREATE_ERROR,
        traceId: diagnostic.traceId,
        diagnostic,
      },
      { status: 500 }
    )
  }
}
