import { createPublicKey, verify as cryptoVerify, type JsonWebKey, type KeyObject } from "node:crypto"

// Minimal, strict JWT (JWS compact) verifier built on node:crypto. No dependency.
//
// Trust rules:
//  - Only asymmetric ES256 / RS256. HS256 is refused: it would need the project's shared signing secret in
//    this app, which can mint tokens for every product in a shared project. "none" is refused.
//  - The signature is verified BEFORE any claim is read or trusted.
//  - Keys come only from the injected key lookup (our configured JWKS), never from the token header
//    (no jku / jwk / x5u following).
//  - Issuer and audience must match configuration exactly. exp is required.
//  - A valid token proves only "this issuer authenticated this subject". It is NOT application authorization;
//    membership is decided separately (lib/auth/membership.ts).

export type JwtAlg = "ES256" | "RS256"

export type JwtClaims = { sub: string; iss: string; exp: number; aud: string | string[]; [claim: string]: unknown }

export type JwtFailure =
  | "malformed"
  | "unsupported_alg"
  | "unknown_key"
  | "bad_key"
  | "bad_signature"
  | "bad_issuer"
  | "bad_audience"
  | "expired"
  | "not_yet_valid"
  | "bad_claims"

export type JwtResult = { ok: true; claims: JwtClaims } | { ok: false; reason: JwtFailure }

export type JwtVerifyOptions = {
  issuer: string
  audience: string
  /** Returns the JWK for this key id, or null if it is not one of ours. */
  getKey: (kid: string) => Promise<JsonWebKey | null>
  /** Epoch seconds. Injected so tests control time. */
  nowSeconds: () => number
  leewaySeconds?: number
}

const MAX_TOKEN_LENGTH = 8192
const MAX_SUBJECT_LENGTH = 200
const B64URL = /^[A-Za-z0-9_-]+$/
const REJECTED_ROLES = new Set(["anon", "service_role"])

const fail = (reason: JwtFailure): JwtResult => ({ ok: false, reason })

function decodeSegment(segment: string): Buffer | null {
  return B64URL.test(segment) ? Buffer.from(segment, "base64url") : null
}

function parseJsonObject(buf: Buffer): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(buf.toString("utf8"))
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function toPublicKey(jwk: JsonWebKey, alg: JwtAlg): KeyObject | null {
  if (jwk.alg !== undefined && jwk.alg !== alg) return null
  if ((jwk as { use?: string }).use !== undefined && (jwk as { use?: string }).use !== "sig") return null
  if (alg === "ES256" && !(jwk.kty === "EC" && jwk.crv === "P-256")) return null
  if (alg === "RS256" && jwk.kty !== "RSA") return null
  try {
    // Never treat a private JWK as acceptable configuration.
    if ((jwk as { d?: unknown }).d !== undefined) return null
    const key = createPublicKey({ key: jwk, format: "jwk" })
    if (alg === "RS256" && (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) return null
    return key
  } catch {
    return null
  }
}

export async function verifyJwt(token: string, options: JwtVerifyOptions): Promise<JwtResult> {
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return fail("malformed")
  const parts = token.split(".")
  if (parts.length !== 3) return fail("malformed")
  const [h, p, s] = parts
  const headerBytes = decodeSegment(h)
  const payloadBytes = decodeSegment(p)
  const signature = decodeSegment(s)
  if (!headerBytes || !payloadBytes || !signature) return fail("malformed")

  const header = parseJsonObject(headerBytes)
  if (!header) return fail("malformed")
  if (header.alg !== "ES256" && header.alg !== "RS256") return fail("unsupported_alg")
  if (header.crit !== undefined) return fail("malformed") // unsupported critical extensions
  if (typeof header.kid !== "string" || header.kid.length === 0 || header.kid.length > 200) return fail("unknown_key")
  const alg: JwtAlg = header.alg

  const jwk = await options.getKey(header.kid)
  if (!jwk) return fail("unknown_key")
  const key = toPublicKey(jwk, alg)
  if (!key) return fail("bad_key")

  const signingInput = Buffer.from(`${h}.${p}`, "ascii")
  let valid = false
  try {
    valid =
      alg === "ES256"
        ? signature.length === 64 && cryptoVerify("sha256", signingInput, { key, dsaEncoding: "ieee-p1363" }, signature)
        : cryptoVerify("sha256", signingInput, key, signature)
  } catch {
    valid = false
  }
  if (!valid) return fail("bad_signature")

  // From here the payload is authentic (signed by a key in our JWKS). Still validate every claim we use.
  const payload = parseJsonObject(payloadBytes)
  if (!payload) return fail("malformed")

  if (payload.iss !== options.issuer) return fail("bad_issuer")
  const aud = payload.aud
  const audOk = typeof aud === "string" ? aud === options.audience : Array.isArray(aud) && aud.includes(options.audience)
  if (!audOk) return fail("bad_audience")

  const leeway = options.leewaySeconds ?? 30
  const now = options.nowSeconds()
  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) return fail("bad_claims")
  if (now - leeway >= payload.exp) return fail("expired")
  if (payload.nbf !== undefined) {
    if (typeof payload.nbf !== "number" || !Number.isFinite(payload.nbf)) return fail("bad_claims")
    if (now + leeway < payload.nbf) return fail("not_yet_valid")
  }

  const { sub, role } = payload
  if (typeof sub !== "string" || sub.length === 0 || sub.length > MAX_SUBJECT_LENGTH) return fail("bad_claims")
  if (typeof role === "string" && REJECTED_ROLES.has(role)) return fail("bad_claims")

  return { ok: true, claims: payload as JwtClaims }
}
