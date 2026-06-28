export type TrustedInternalOperatorPrincipal = {
  kind: "internal_operator"
  subject: string
}

export type TrustedInternalOperatorIdentityResult =
  | {
      status: "authenticated"
      principal: TrustedInternalOperatorPrincipal
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
  void request
  // Fail closed until a verified server-side identity mechanism is integrated.
  return { status: "unauthenticated" }
}
