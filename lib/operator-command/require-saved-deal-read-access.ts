import {
  resolveTrustedInternalOperatorIdentity,
  type TrustedInternalOperatorIdentityResult,
  type TrustedInternalOperatorPrincipal,
} from "@/lib/operator-command/trusted-internal-operator-identity"
import { isSameOrigin, isStateChanging } from "@/lib/auth/session"
import { isDevelopmentOpen } from "@/lib/operator-command/guard-saved-deal-api"

export type SavedDealReadAccessResult =
  | {
      allowed: true
      principal: TrustedInternalOperatorPrincipal
    }
  | {
      allowed: false
      reason: "unauthenticated"
      status: 401
      code: "AUTHENTICATION_REQUIRED"
    }
  | {
      allowed: false
      reason: "cross_origin"
      status: 403
      code: "CROSS_ORIGIN_REJECTED"
    }
  | {
      allowed: false
      reason: "unauthorized"
      status: 404
      code: "SAVED_DEAL_NOT_FOUND"
    }

const AUTHENTICATION_REQUIRED_CODE = "AUTHENTICATION_REQUIRED" as const
const SAVED_DEAL_NOT_FOUND_CODE = "SAVED_DEAL_NOT_FOUND" as const

function buildUnauthenticatedResult(): SavedDealReadAccessResult {
  return {
    allowed: false,
    reason: "unauthenticated",
    status: 401,
    code: AUTHENTICATION_REQUIRED_CODE,
  }
}

function buildCrossOriginResult(): SavedDealReadAccessResult {
  return { allowed: false, reason: "cross_origin", status: 403, code: "CROSS_ORIGIN_REJECTED" }
}

function buildUnauthorizedResult(): SavedDealReadAccessResult {
  return {
    allowed: false,
    reason: "unauthorized",
    status: 404,
    code: SAVED_DEAL_NOT_FOUND_CODE,
  }
}

function buildAllowedResult(principal: TrustedInternalOperatorPrincipal): SavedDealReadAccessResult {
  return {
    allowed: true,
    principal,
  }
}

export async function requireSavedDealReadAccess(
  request: Request,
  dealId?: string,
): Promise<SavedDealReadAccessResult> {
  if (isDevelopmentOpen()) {
    return buildAllowedResult({ kind: "internal_operator", subject: "local-dev-operator" })
  }
  // Authorization policy today: every active operator may use every saved deal. saved_deals has no owner column, so a
  // deal id on its own is never treated as proof of ownership; this is the single place a per-deal rule would be added.
  void dealId

  let identity: TrustedInternalOperatorIdentityResult

  try {
    identity = await resolveTrustedInternalOperatorIdentity(request)
  } catch {
    return buildUnauthenticatedResult()
  }

  if (identity.status === "authenticated") {
    if (identity.principal.kind === "internal_operator") {
      // Cookies are sent by the browser automatically, so a cookie-authenticated change must come from this site.
      if (identity.credential === "session" && isStateChanging(request) && !isSameOrigin(request)) {
        return buildCrossOriginResult()
      }
      return buildAllowedResult(identity.principal)
    }

    return buildUnauthorizedResult()
  }

  if (identity.status === "unauthorized") {
    return buildUnauthorizedResult()
  }

  return buildUnauthenticatedResult()
}
