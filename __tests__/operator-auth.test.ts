import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createJwksKeyProvider } from "@/lib/auth/jwks"
import { verifyJwt } from "@/lib/auth/jwt"
import {
  __setOperatorAuthDepsForTests,
  createAllowlistMembershipStore,
  createBearerJwtProvider,
  readOperatorAuthDeps,
  resolveOperatorIdentity,
  type OperatorAuthDeps,
} from "@/lib/auth/operator-auth"
import { resolveTrustedInternalOperatorIdentity } from "@/lib/operator-command/trusted-internal-operator-identity"
import {
  AUDIENCE,
  ISSUER,
  NOW,
  confusionJwt,
  createTestIdentityProvider,
  keyLookup,
  makeEcKey,
  makeRsaKey,
  noneJwt,
  signJwt,
  validClaims,
} from "./fixtures/auth-fixtures"

const ec = makeEcKey("ec-1")
const rsa = makeRsaKey("rsa-1")
const other = makeEcKey("ec-1") // same kid, different key material
const opts = { issuer: ISSUER, audience: AUDIENCE, getKey: keyLookup(ec, rsa), nowSeconds: () => NOW }
const verify = (token: string, over: Partial<typeof opts> = {}) => verifyJwt(token, { ...opts, ...over })

afterEach(() => __setOperatorAuthDepsForTests(undefined))

describe("verifyJwt: accepts only genuine tokens", () => {
  it("accepts ES256 and RS256 tokens from a known key", async () => {
    expect(await verify(signJwt(ec))).toMatchObject({ ok: true, claims: { sub: "user-1" } })
    expect(await verify(signJwt(rsa))).toMatchObject({ ok: true, claims: { sub: "user-1" } })
  })

  it("accepts an audience array containing ours, and small clock skew", async () => {
    expect((await verify(signJwt(ec, validClaims({ aud: ["x", AUDIENCE] })))).ok).toBe(true)
    expect((await verify(signJwt(ec, validClaims({ exp: NOW - 10 })))).ok).toBe(true) // inside 30s leeway
  })

  it.each([
    ["expired", validClaims({ exp: NOW - 31 }), "expired"],
    ["not yet valid", validClaims({ nbf: NOW + 31 }), "not_yet_valid"],
    ["wrong issuer", validClaims({ iss: "https://evil.test/auth/v1" }), "bad_issuer"],
    ["wrong audience", validClaims({ aud: "some-other-product" }), "bad_audience"],
    ["audience array without ours", validClaims({ aud: ["a", "b"] }), "bad_audience"],
    ["missing audience", (() => { const c: Record<string, unknown> = validClaims(); delete c.aud; return c })(), "bad_audience"],
    ["missing exp", (() => { const c: Record<string, unknown> = validClaims(); delete c.exp; return c })(), "bad_claims"],
    ["string exp", validClaims({ exp: String(NOW + 100) }), "bad_claims"],
    ["missing sub", (() => { const c: Record<string, unknown> = validClaims(); delete c.sub; return c })(), "bad_claims"],
    ["empty sub", validClaims({ sub: "" }), "bad_claims"],
    ["anon key role", validClaims({ role: "anon" }), "bad_claims"],
    ["service_role key", validClaims({ role: "service_role" }), "bad_claims"],
  ])("rejects %s", async (_label, claims, reason) => {
    expect(await verify(signJwt(ec, claims))).toEqual({ ok: false, reason })
  })

  it("rejects alg none, HS256 key confusion, and unsupported algorithms", async () => {
    expect(await verify(noneJwt())).toEqual({ ok: false, reason: "malformed" }) // empty signature segment
    const noneWithSignature = noneJwt().replace(/\.$/, ".AAAA")
    expect(await verify(noneWithSignature)).toEqual({ ok: false, reason: "unsupported_alg" })
    expect(await verify(confusionJwt(ec))).toEqual({ ok: false, reason: "unsupported_alg" })
    expect(await verify(signJwt(ec, validClaims(), { alg: "ES512" }))).toEqual({ ok: false, reason: "unsupported_alg" })
  })

  it("rejects forged, tampered, re-keyed and wrong-algorithm tokens", async () => {
    const good = signJwt(ec)
    const [h, , s] = good.split(".")
    const forgedPayload = Buffer.from(JSON.stringify(validClaims({ sub: "attacker" }))).toString("base64url")
    expect(await verify(`${h}.${forgedPayload}.${s}`)).toEqual({ ok: false, reason: "bad_signature" })
    expect(await verify(signJwt(other))).toEqual({ ok: false, reason: "bad_signature" }) // right kid, wrong key
    expect(await verify(signJwt(ec, validClaims(), { alg: "RS256" }))).toEqual({ ok: false, reason: "bad_key" }) // header/key mismatch
    expect(await verify(signJwt(ec, validClaims(), { kid: "nope" }))).toEqual({ ok: false, reason: "unknown_key" })
    expect(await verify(signJwt(ec, validClaims(), { kid: undefined }))).toEqual({ ok: false, reason: "unknown_key" })
  })

  it("verifies the signature before looking at any claim", async () => {
    // Wrong signer AND wrong issuer: must report the signature, never leak claim-level detail.
    expect(await verify(signJwt(other, validClaims({ iss: "https://evil.test" })))).toEqual({ ok: false, reason: "bad_signature" })
  })

  it("never follows keys embedded in the token (jwk/jku/x5u are ignored)", async () => {
    const attacker = makeEcKey("attacker")
    const t = signJwt(attacker, validClaims(), { kid: "ec-1", jwk: attacker.jwk, jku: "https://evil.test/jwks.json" })
    expect(await verify(t)).toEqual({ ok: false, reason: "bad_signature" })
  })

  it("rejects critical extensions, private JWKs, mismatched JWK metadata, and weak RSA keys", async () => {
    expect(await verify(signJwt(ec, validClaims(), { crit: ["exp"] }))).toEqual({ ok: false, reason: "malformed" })
    const withPrivate = { ...ec, jwk: { ...ec.jwk, d: "AAAA" } }
    expect(await verify(signJwt(ec), { getKey: keyLookup(withPrivate) })).toEqual({ ok: false, reason: "bad_key" })
    const wrongAlg = { ...ec, jwk: { ...ec.jwk, alg: "RS256" } }
    expect(await verify(signJwt(ec), { getKey: keyLookup(wrongAlg) })).toEqual({ ok: false, reason: "bad_key" })
    const weak = makeRsaKey("weak", 1024)
    expect(await verify(signJwt(weak), { getKey: keyLookup(weak) })).toEqual({ ok: false, reason: "bad_key" })
  })

  it("rejects malformed input", async () => {
    for (const t of ["", "a.b", "a.b.c.d", "!!!.!!!.!!!", `${signJwt(ec)}x`.replace(/\./g, "..")]) {
      expect((await verify(t)).ok).toBe(false)
    }
    expect(await verify("a".repeat(9000))).toEqual({ ok: false, reason: "malformed" })
    expect(await verify(`${Buffer.from("[]").toString("base64url")}.e30.AAAA`)).toEqual({ ok: false, reason: "malformed" })
  })
})

describe("JWKS key provider", () => {
  const jwks = (...keys: { jwk: unknown }[]) => JSON.stringify({ keys: keys.map((k) => k.jwk) })
  const okFetch = (body: string, status = 200) => vi.fn(async () => new Response(body, { status }))

  it("refuses non-https URLs", () => {
    expect(() => createJwksKeyProvider({ url: "http://example.test/jwks" })).toThrow()
  })

  it("fetches once, caches, and finds keys by kid", async () => {
    const f = okFetch(jwks(ec, rsa))
    const get = createJwksKeyProvider({ url: "https://example.test/jwks", fetchImpl: f as unknown as typeof fetch })
    expect((await get("ec-1"))?.kty).toBe("EC")
    expect((await get("rsa-1"))?.kty).toBe("RSA")
    expect(f).toHaveBeenCalledTimes(1)
    expect((f.mock.calls[0] as unknown[])[1]).toMatchObject({ redirect: "error" })
  })

  it("rate-limits refetches for unknown kids, then picks up a rotated key", async () => {
    let t = 0
    let body = jwks(ec)
    const f = vi.fn(async () => new Response(body))
    const get = createJwksKeyProvider({ url: "https://example.test/jwks", fetchImpl: f as unknown as typeof fetch, nowMs: () => t })
    await get("ec-1")
    for (let i = 0; i < 20; i++) expect(await get("rotated")).toBeNull()
    expect(f).toHaveBeenCalledTimes(1) // flood of unknown kids does not flood the network
    body = jwks(ec, rsa)
    t += 61_000
    expect((await get("rsa-1"))?.kty).toBe("RSA")
    expect(f).toHaveBeenCalledTimes(2)
  })

  it("returns null on HTTP errors, oversize bodies, bad JSON and network failure, never throwing", async () => {
    for (const f of [okFetch("{}", 500), okFetch("x".repeat(70_000)), okFetch("not json"), vi.fn(async () => { throw new Error("down") })]) {
      const get = createJwksKeyProvider({ url: "https://example.test/jwks", fetchImpl: f as unknown as typeof fetch })
      expect(await get("ec-1")).toBeNull()
    }
  })

  it("stops trusting cached keys when refreshes keep failing", async () => {
    let t = 0
    let fail = false
    const f = vi.fn(async () => (fail ? new Response("", { status: 500 }) : new Response(jwks(ec))))
    const get = createJwksKeyProvider({ url: "https://example.test/jwks", fetchImpl: f as unknown as typeof fetch, nowMs: () => t, cacheTtlMs: 1000 })
    expect(await get("ec-1")).not.toBeNull()
    fail = true
    t += 2_000
    expect(await get("ec-1")).not.toBeNull() // short outage: serve cached
    t += 10_000
    expect(await get("ec-1")).toBeNull() // outage beyond 3x TTL: fail closed
  })
})

describe("operator identity: authentication is not authorization", () => {
  const provider = createBearerJwtProvider({ issuer: ISSUER, audience: AUDIENCE, jwksUrl: `${ISSUER}/.well-known/jwks.json` }, keyLookup(ec), () => NOW)
  const deps: OperatorAuthDeps = { provider, membership: createAllowlistMembershipStore("operator-1,operator-2")! }
  const bearer = (token: string) => new Request("http://localhost/x", { headers: { authorization: `Bearer ${token}` } })

  it("authenticates a member and exposes only the verified subject", async () => {
    __setOperatorAuthDepsForTests(deps)
    expect(await resolveTrustedInternalOperatorIdentity(bearer(signJwt(ec, validClaims({ sub: "operator-1" }))))).toEqual({
      status: "authenticated",
      principal: { kind: "internal_operator", subject: "operator-1" },
    })
  })

  it("denies a VALID token from another product's user in the shared project (not a member)", async () => {
    __setOperatorAuthDepsForTests(deps)
    expect(await resolveOperatorIdentity(bearer(signJwt(ec, validClaims({ sub: "someone-from-another-app" }))))).toEqual({ status: "unauthorized" })
  })

  it("treats missing, malformed, expired, forged and wrong-audience credentials as unauthenticated", async () => {
    __setOperatorAuthDepsForTests(deps)
    const cases = [
      new Request("http://localhost/x"),
      new Request("http://localhost/x", { headers: { authorization: "Basic abc" } }),
      bearer("not-a-jwt"),
      bearer(signJwt(ec, validClaims({ sub: "operator-1", exp: NOW - 100 }))),
      bearer(signJwt(ec, validClaims({ sub: "operator-1", aud: "other" }))),
      bearer(signJwt(other, validClaims({ sub: "operator-1" }))),
      bearer(noneJwt(validClaims({ sub: "operator-1" }))),
    ]
    for (const r of cases) expect(await resolveOperatorIdentity(r)).toEqual({ status: "unauthenticated" })
  })

  it("ignores client-supplied identity or role headers and query parameters", async () => {
    __setOperatorAuthDepsForTests(deps)
    const r = new Request("http://localhost/x?user=operator-1&role=admin", {
      headers: { "x-user-id": "operator-1", "x-role": "admin", "x-internal-operator": "true", cookie: "sb-access-token=abc" },
    })
    expect(await resolveOperatorIdentity(r)).toEqual({ status: "unauthenticated" })
  })

  it("fails closed when the provider or membership store throws", async () => {
    const boom = async () => { throw new Error("boom") }
    __setOperatorAuthDepsForTests({ provider: { authenticate: boom }, membership: deps.membership })
    expect(await resolveOperatorIdentity(bearer("x"))).toEqual({ status: "unauthenticated" })
    __setOperatorAuthDepsForTests({ provider: createTestIdentityProvider({ t: "operator-1" }), membership: { isActiveOperator: boom } })
    expect(await resolveOperatorIdentity(bearer("t"))).toEqual({ status: "unauthenticated" })
  })

  it("is unauthenticated without configuration, even when a valid token is presented", async () => {
    __setOperatorAuthDepsForTests(undefined)
    for (const k of ["OPERATOR_AUTH_MODE", "OPERATOR_JWT_ISSUER", "OPERATOR_JWT_AUDIENCE", "OPERATOR_JWKS_URL", "OPERATOR_ALLOWED_SUBJECTS"]) vi.stubEnv(k, "")
    expect(await resolveOperatorIdentity(bearer(signJwt(ec, validClaims({ sub: "operator-1" }))))).toEqual({ status: "unauthenticated" })
    vi.unstubAllEnvs()
  })
})

describe("configuration is fail-closed", () => {
  const good = {
    OPERATOR_AUTH_MODE: "supabase-jwt",
    OPERATOR_JWT_ISSUER: "https://abc.supabase.co/auth/v1",
    OPERATOR_JWT_AUDIENCE: "authenticated",
    OPERATOR_JWKS_URL: "https://abc.supabase.co/auth/v1/.well-known/jwks.json",
    OPERATOR_ALLOWED_SUBJECTS: "operator-1, operator-2",
  }

  it("builds deps only from a complete, valid configuration", () => {
    expect(readOperatorAuthDeps(good)).not.toBeNull()
  })

  it.each([
    ["no mode", { OPERATOR_AUTH_MODE: undefined }],
    ["a mode that is not the real provider (e.g. a test/static mode)", { OPERATOR_AUTH_MODE: "test" }],
    ["no issuer", { OPERATOR_JWT_ISSUER: undefined }],
    ["no audience", { OPERATOR_JWT_AUDIENCE: "" }],
    ["no jwks url", { OPERATOR_JWKS_URL: undefined }],
    ["http issuer", { OPERATOR_JWT_ISSUER: "http://abc.supabase.co/auth/v1" }],
    ["jwks on another origin", { OPERATOR_JWKS_URL: "https://evil.test/.well-known/jwks.json" }],
    ["empty allowlist", { OPERATOR_ALLOWED_SUBJECTS: " , " }],
    ["allowlist with an invalid entry", { OPERATOR_ALLOWED_SUBJECTS: "operator-1,bad entry!" }],
    ["unparsable url", { OPERATOR_JWT_ISSUER: "not a url" }],
  ])("returns null for %s", (_label, over) => {
    expect(readOperatorAuthDeps({ ...good, ...over })).toBeNull()
  })

  it("allowlist membership is exact-match", async () => {
    const store = createAllowlistMembershipStore(" a ,b")!
    expect([await store.isActiveOperator("a"), await store.isActiveOperator("b"), await store.isActiveOperator("A"), await store.isActiveOperator("a,b"), await store.isActiveOperator("")]).toEqual([true, true, false, false, false])
  })
})

describe("test-only identity adapter cannot reach deployed code", () => {
  it("the test seam refuses to run outside NODE_ENV=test", () => {
    vi.stubEnv("NODE_ENV", "production")
    expect(() => __setOperatorAuthDepsForTests(null)).toThrow(/test-only/)
    vi.unstubAllEnvs()
  })

  it("no application source imports the auth test fixtures, the test adapter, or the test seam", () => {
    const root = path.resolve(__dirname, "..")
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.(ts|tsx)$/.test(name)) files.push(full)
      }
    }
    for (const d of ["app", "lib", "components", "types"]) walk(path.join(root, d))
    for (const f of files) {
      const src = readFileSync(f, "utf8")
      expect(src, f).not.toMatch(/from\s+"[^"]*(auth-fixtures|test-identity)[^"]*"/)
      if (!f.endsWith(path.join("lib", "auth", "operator-auth.ts"))) expect(src, f).not.toMatch(/__setOperatorAuthDepsForTests/)
    }
  })

  it("holds no static credentials: the auth modules contain no tokens, keys or default identities", () => {
    const root = path.resolve(__dirname, "..")
    for (const f of ["jwt.ts", "jwks.ts", "operator-auth.ts"]) {
      const src = readFileSync(path.join(root, "lib/auth", f), "utf8")
      expect(src, f).not.toMatch(/BEGIN (RSA |EC )?(PRIVATE|PUBLIC) KEY|eyJ[A-Za-z0-9_-]{10,}|password|secret\s*[:=]/i)
    }
  })
})
