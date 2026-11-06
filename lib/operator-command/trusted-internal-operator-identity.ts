import { resolveOperatorIdentity } from "@/lib/auth/operator-auth"

export type TrustedInternalOperatorPrincipal = {
  kind: "internal_operator"
  subject: string
}

export type TrustedInternalOperatorIdentityResult =
  | {
      status: "authenticated"
      principal: TrustedInternalOperatorPrincipal
      credential?: "bearer" | "session"
    }
  | {
      status: "unauthenticated"
    }
  | {
      status: "unauthorized"
    }

export async function resolveTrustedInternalOperatorIdentity(
  request: Request,
): Promise<TrustedInternalOperatorIdentityResult> {
  const result = await resolveOperatorIdentity(request)
  if (result.status === "verified") {
    return {
      status: "authenticated",
      principal: { kind: "internal_operator", subject: result.subject },
      credential: result.credential === "bearer" ? "bearer" : "session",
    }
  }
  if (result.status === "unauthorized") {
    return { status: "unauthorized" }
  }
  return { status: "unauthenticated" }
}
