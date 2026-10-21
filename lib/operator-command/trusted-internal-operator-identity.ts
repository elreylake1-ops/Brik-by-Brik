import { resolveOperatorIdentity } from "@/lib/auth/operator-auth"

export type TrustedInternalOperatorPrincipal = {
  kind: "internal_operator"
  subject: string
}

export type TrustedInternalOperatorIdentityResult =
  | {
      status: "authenticated"
      principal: TrustedInternalOperatorPrincipal
      // how the caller proved identity; cookie credentials are ambient, so they additionally require a CSRF check
      credential?: "bearer" | "session"
    }
  | {
      status: "unauthenticated"
    }
  | {
      status: "unauthorized"
    }

// Delegates to the server-side identity boundary (lib/auth/operator-auth.ts). With no operator auth
// configuration this still returns "unauthenticated" for every request: fail closed.
export async function resolveTrustedInternalOperatorIdentity(
  request: Request,
): Promise<TrustedInternalOperatorIdentityResult> {
  return resolveOperatorIdentity(request)
}
