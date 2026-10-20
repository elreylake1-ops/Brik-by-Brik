import { createHmac, generateKeyPairSync, sign, type JsonWebKey, type KeyObject } from "node:crypto"
import type { IdentityProvider } from "@/lib/auth/operator-auth"

// TEST-ONLY. Lives under __tests__ so application code cannot import it (a test asserts this).
// Real keys and real signatures, generated per test run: nothing here is a credential.

export const ISSUER = "https://example-project.test/auth/v1"
export const AUDIENCE = "authenticated"
export const NOW = 1_800_000_000 // fixed epoch seconds

export type TestKey = { kid: string; alg: "ES256" | "RS256"; privateKey: KeyObject; jwk: JsonWebKey }

export function makeEcKey(kid = "ec-1"): TestKey {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" })
  return { kid, alg: "ES256", privateKey, jwk: { ...publicKey.export({ format: "jwk" }), kid, alg: "ES256", use: "sig" } as JsonWebKey }
}

export function makeRsaKey(kid = "rsa-1", bits = 2048): TestKey {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: bits })
  return { kid, alg: "RS256", privateKey, jwk: { ...publicKey.export({ format: "jwk" }), kid, alg: "RS256", use: "sig" } as JsonWebKey }
}

const b64 = (v: unknown) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url")

export function validClaims(over: Record<string, unknown> = {}) {
  return { iss: ISSUER, aud: AUDIENCE, sub: "user-1", exp: NOW + 3600, iat: NOW - 10, role: "authenticated", ...over }
}

export function signJwt(key: TestKey, claims: Record<string, unknown> = validClaims(), headerOver: Record<string, unknown> = {}) {
  const header = { alg: key.alg, kid: key.kid, typ: "JWT", ...headerOver }
  const input = `${b64(header)}.${b64(claims)}`
  const signature =
    key.alg === "ES256"
      ? sign("sha256", Buffer.from(input), { key: key.privateKey, dsaEncoding: "ieee-p1363" })
      : sign("sha256", Buffer.from(input), key.privateKey)
  return `${input}.${signature.toString("base64url")}`
}

/** Unsigned "alg":"none" token. */
export const noneJwt = (claims = validClaims()) => `${b64({ alg: "none", typ: "JWT" })}.${b64(claims)}.`

/** HS256 token "signed" with the public JWK text as the HMAC secret: the classic algorithm-confusion attack. */
export function confusionJwt(key: TestKey, claims = validClaims()) {
  const input = `${b64({ alg: "HS256", kid: key.kid, typ: "JWT" })}.${b64(claims)}`
  return `${input}.${createHmac("sha256", JSON.stringify(key.jwk)).update(input).digest("base64url")}`
}

export const keyLookup = (...keys: TestKey[]) => async (kid: string) => keys.find((k) => k.kid === kid)?.jwk ?? null

/** Test-only identity adapter: opaque tokens to subjects. Never reachable from configuration. */
export function createTestIdentityProvider(tokens: Record<string, string>): IdentityProvider {
  return {
    async authenticate(request) {
      const header = request.headers.get("authorization")
      if (!header) return { status: "absent" }
      const token = /^Bearer (.+)$/.exec(header)?.[1]
      const subject = token ? tokens[token] : undefined
      return subject ? { status: "verified", subject } : { status: "invalid" }
    },
  }
}
