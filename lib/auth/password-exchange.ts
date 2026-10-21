import type { CredentialExchange, SupabaseJwtConfig } from "./operator-auth"
import type { KeyProvider } from "./jwks"
import { verifyJwt } from "./jwt"

// Identity-provider adapter: exchanges an email + password for a VERIFIED SUBJECT using a Supabase-Auth-style password
// grant (POST {grantUrl} with an `apikey` header and {email, password}). The returned access/refresh tokens are verified
// with the same JWKS verifier used for bearer tokens and are then discarded: they never reach the browser, a cookie, a
// log or the database. Only the verified `sub` is returned.
//
// NOT CONNECTED to any project in this repository's QA: it activates only when OPERATOR_PASSWORD_GRANT_URL and
// OPERATOR_PASSWORD_GRANT_API_KEY are both configured, and the URL must be https on the issuer's own origin. Which
// provider and project to use is an open owner decision (docs/option2/AUTH_AND_PREVIEW_READINESS.md).

export type FetchLike = (url: string, init: { method: "POST"; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

const EXCHANGE_TIMEOUT_MS = 8000

export function createSupabasePasswordExchange(
  env: Record<string, string | undefined>,
  config: SupabaseJwtConfig,
  getKey: KeyProvider,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
  nowSeconds: () => number = () => Math.floor(Date.now() / 1000)
): CredentialExchange | null {
  const grantUrl = env.OPERATOR_PASSWORD_GRANT_URL
  const apiKey = env.OPERATOR_PASSWORD_GRANT_API_KEY
  if (!grantUrl || !apiKey) return null
  try {
    const grant = new URL(grantUrl)
    if (grant.protocol !== "https:" || grant.origin !== new URL(config.issuer).origin) return null
  } catch {
    return null
  }
  return {
    async signIn(email, password) {
      try {
        const response = await fetchImpl(grantUrl, {
          method: "POST",
          headers: { "content-type": "application/json", apikey: apiKey },
          body: JSON.stringify({ email, password }),
          signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
        })
        if (!response.ok) return { status: "invalid" }
        const body = (await response.json()) as { access_token?: unknown }
        if (typeof body?.access_token !== "string") return { status: "invalid" }
        const verified = await verifyJwt(body.access_token, { issuer: config.issuer, audience: config.audience, getKey, nowSeconds })
        return verified.ok ? { status: "verified", subject: verified.claims.sub } : { status: "invalid" }
      } catch {
        return { status: "invalid" }
      }
    },
  }
}
