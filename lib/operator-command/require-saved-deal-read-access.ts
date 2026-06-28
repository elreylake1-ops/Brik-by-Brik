import {
  resolveTrustedInternalOperatorIdentity,
  type TrustedInternalOperatorIdentityResult,
  type TrustedInternalOperatorPrincipal,
} from "@/lib/operator-command/trusted-internal-operator-identity"

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
  void dealId

  let identity: TrustedInternalOperatorIdentityResult

  try {
    identity = await resolveTrustedInternalOperatorIdentity(request)
  } catch {
    return buildUnauthenticatedResult()
  }

  if (identity.status === "authenticated") {
    if (identity.principal.kind === "internal_operator") {
      return buildAllowedResult(identity.principal)
    }

    return buildUnauthorizedResult()
  }

  if (identity.status === "unauthorized") {
    return buildUnauthorizedResult()
  }

  return buildUnauthenticatedResult()
}
