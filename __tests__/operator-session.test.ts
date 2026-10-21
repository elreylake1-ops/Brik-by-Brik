import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { __setOperatorAuthDepsForTests, createAllowlistMembershipStore, resolveOperatorIdentity, type CredentialExchange, type OperatorAuthDeps } from "@/lib/auth/operator-auth"
import { createSupabasePasswordExchange } from "@/lib/auth/password-exchange"
import {
  SESSION_ABSOLUTE_MS,
  SESSION_IDLE_MS,
  hashSessionId,
  readSessionId,
} from "@/lib/auth/session"
import { __resetSignInThrottleForTests, safeNextPath, signInRequest, signOutRequest } from "@/lib/auth/sign-in"
import { requireSavedDealReadAccess } from "@/lib/operator-command/require-saved-deal-read-access"
import { AUDIENCE, ISSUER, NOW, keyLookup, makeEcKey, signJwt, validClaims } from "./fixtures/auth-fixtures"
import { createInMemorySessionStore } from "./fixtures/in-memory-session-store"
import { createTestIdentityProvider } from "./fixtures/auth-fixtures"

// Cookie sessions: sign-in, expiry, revocation, membership, CSRF and cookie hygiene. The identity provider is a stand-in
// (a password table); everything after it is the real code.

const T0 = new Date("2026-10-21T09:00:00.000Z")
let clock = T0
const sessions = createInMemorySessionStore()
const PASSWORDS: Record<string, { password: string; subject: string }> = {
  "op@example.test": { password: "correct horse", subject: "operator-1" },
  "stranger@example.test": { password: "correct horse", subject: "stranger-1" }, // valid account in the shared project, not an operator
}
const credentials: CredentialExchange = {
  async signIn(email, password) {
    const a = PASSWORDS[email]
    return a && a.password === password ? { status: "verified", subject: a.subject } : { status: "invalid" }
  },
}
let members = "operator-1"
const deps = (): OperatorAuthDeps => ({
  provider: createTestIdentityProvider({ "tok-op": "operator-1" }),
  membership: createAllowlistMembershipStore(members) ?? { isActiveOperator: async () => false },
  sessions,
  credentials,
  now: () => clock,
})

const HTTPS = "https://app.example.test"
const HTTP = "http://localhost:3000"
function post(base: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${base}/api/auth/session`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base, host: new URL(base).host, ...headers },
    body: JSON.stringify(body),
  })
}
const cookieOf = (setCookie: string | undefined) => setCookie!.split(";")[0]
async function signIn(base = HTTPS, email = "op@example.test", password = "correct horse") {
  const r = await signInRequest(post(base, { email, password }))
  return { r, cookie: r.setCookie ? cookieOf(r.setCookie) : undefined }
}
const withCookie = (cookie: string | undefined, init: RequestInit & { url?: string } = {}) =>
  new Request(init.url ?? `${HTTPS}/api/saved-deals`, { ...init, headers: { ...(cookie ? { cookie } : {}), ...(init.headers as Record<string, string>) } })

beforeEach(() => {
  clock = T0
  members = "operator-1"
  sessions.rows.clear()
  __resetSignInThrottleForTests()
  __setOperatorAuthDepsForTests(deps())
})
afterEach(() => __setOperatorAuthDepsForTests(undefined))

describe("sign-in", () => {
  it("creates a session for an operator and sets a hardened cookie", async () => {
    const { r } = await signIn()
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ success: true }) // no token, no subject, no role in the body
    const attrs = r.setCookie!.split("; ")
    expect(attrs[0]).toMatch(/^__Host-brik_session=[A-Za-z0-9_-]{43}$/)
    expect(attrs).toEqual(expect.arrayContaining(["Path=/", "HttpOnly", "SameSite=Lax", "Secure", `Max-Age=${SESSION_ABSOLUTE_MS / 1000}`]))
    expect(attrs.some((a) => /^Domain=/i.test(a))).toBe(false) // __Host- forbids Domain
  })

  it("over plain http (local QA) uses the unprefixed name and omits Secure, but stays HttpOnly + SameSite", async () => {
    const { r } = await signIn(HTTP)
    expect(r.setCookie).toMatch(/^brik_session=/)
    expect(r.setCookie).not.toMatch(/Secure/)
    expect(r.setCookie).toMatch(/HttpOnly/)
    expect(r.setCookie).toMatch(/SameSite=Lax/)
  })

  it("trusts x-forwarded-proto=https when running behind a TLS-terminating proxy", async () => {
    const r = await signInRequest(post(HTTP, { email: "op@example.test", password: "correct horse" }, { "x-forwarded-proto": "https" }))
    expect(r.setCookie).toMatch(/^__Host-brik_session=.*Secure/)
  })

  it("stores only a hash of the session id and the verified subject, never the raw id or any token", async () => {
    const { cookie } = await signIn()
    const id = cookie!.split("=")[1]
    expect([...sessions.rows.keys()]).toEqual([hashSessionId(id)])
    expect(JSON.stringify([...sessions.rows.entries()])).not.toContain(id)
    expect([...sessions.rows.values()][0].subject).toBe("operator-1")
  })

  it("issues a fresh, unpredictable id every time and revokes the one it replaces (no session fixation)", async () => {
    const first = (await signIn()).cookie!
    const second = (await signInRequest(post(HTTPS, { email: "op@example.test", password: "correct horse" }, { cookie: first }))).setCookie!
    expect(cookieOf(second)).not.toBe(first)
    expect((await resolveOperatorIdentity(withCookie(first))).status).toBe("unauthenticated")
    expect((await resolveOperatorIdentity(withCookie(cookieOf(second)))).status).toBe("authenticated")
  })

  it("never reveals why sign-in failed: wrong password, unknown account and non-operator look identical, and a non-operator gets no session", async () => {
    const results = [
      await signIn(HTTPS, "op@example.test", "wrong"),
      await signIn(HTTPS, "nobody@example.test", "x"),
      await signIn(HTTPS, "stranger@example.test", "correct horse"),
    ].map((x) => x.r)
    for (const r of results) expect(r).toEqual({ status: 401, body: { success: false, error: "SIGN_IN_FAILED" } })
    expect(sessions.rows.size).toBe(0)
  })

  it("rejects a cross-site sign-in attempt (login CSRF) and a missing Origin", async () => {
    const evil = await signInRequest(post(HTTPS, { email: "op@example.test", password: "correct horse" }, { origin: "https://evil.example" }))
    expect(evil.status).toBe(403)
    const noOrigin = new Request(`${HTTPS}/api/auth/session`, { method: "POST", headers: { host: "app.example.test" }, body: JSON.stringify({ email: "op@example.test", password: "correct horse" }) })
    expect((await signInRequest(noOrigin)).status).toBe(403)
    expect(sessions.rows.size).toBe(0)
  })

  it("throttles repeated failures (5 per 15 minutes) and recovers afterwards", async () => {
    for (let i = 0; i < 5; i++) expect((await signIn(HTTPS, "op@example.test", "bad")).r.status).toBe(401)
    expect((await signIn(HTTPS, "op@example.test", "correct horse")).r.status).toBe(429) // even the right password
    clock = new Date(T0.getTime() + 16 * 60 * 1000)
    expect((await signIn()).r.status).toBe(200)
  })

  it("validates the body", async () => {
    for (const body of [{}, { email: "a@b.test" }, { email: 1, password: "x" }, { email: "a@b.test", password: "x".repeat(1100) }]) {
      expect((await signInRequest(post(HTTPS, body))).status).toBe(400)
    }
    expect((await signInRequest(post(HTTPS, { email: "a@b.test", password: "x".repeat(5000) }))).status).toBe(413)
    const malformed = new Request(`${HTTPS}/api/auth/session`, { method: "POST", headers: { origin: HTTPS, host: "app.example.test" }, body: "{nope" })
    expect((await signInRequest(malformed)).status).toBe(400)
  })

  it("is unavailable (503) when no sign-in provider is configured, never a fallback identity", async () => {
    __setOperatorAuthDepsForTests({ ...deps(), credentials: undefined })
    expect((await signInRequest(post(HTTPS, { email: "op@example.test", password: "correct horse" }))).status).toBe(503)
    __setOperatorAuthDepsForTests(null)
    expect((await signInRequest(post(HTTPS, { email: "op@example.test", password: "correct horse" }))).status).toBe(503)
  })
})

describe("using a session", () => {
  it("authenticates the cookie holder as the stored subject and marks the credential as a session", async () => {
    const { cookie } = await signIn()
    expect(await resolveOperatorIdentity(withCookie(cookie))).toEqual({
      status: "authenticated",
      principal: { kind: "internal_operator", subject: "operator-1" },
      credential: "session",
    })
  })

  it("rejects absent, malformed, tampered, truncated and unknown cookies", async () => {
    const { cookie } = await signIn()
    const id = cookie!.split("=")[1]
    for (const bad of [undefined, "", "brik_session=", "__Host-brik_session=short", `__Host-brik_session=${id.slice(0, -2)}xx`, `__Host-brik_session=${id}${id}`, `other=${id}`]) {
      expect((await resolveOperatorIdentity(withCookie(bad))).status, String(bad)).toBe("unauthenticated")
    }
  })

  it("expires at the absolute limit even if used constantly", async () => {
    const { cookie } = await signIn()
    for (let t = 30; t < SESSION_ABSOLUTE_MS / 60_000; t += 30) {
      clock = new Date(T0.getTime() + t * 60_000)
      expect((await resolveOperatorIdentity(withCookie(cookie))).status).toBe("authenticated")
    }
    clock = new Date(T0.getTime() + SESSION_ABSOLUTE_MS)
    expect((await resolveOperatorIdentity(withCookie(cookie))).status).toBe("unauthenticated")
  })

  it("expires after the idle window with no use, and use keeps it alive", async () => {
    const { cookie } = await signIn()
    clock = new Date(T0.getTime() + SESSION_IDLE_MS - 1000)
    expect((await resolveOperatorIdentity(withCookie(cookie))).status).toBe("authenticated")
    clock = new Date(T0.getTime() + SESSION_IDLE_MS - 1000 + SESSION_IDLE_MS - 1000)
    expect((await resolveOperatorIdentity(withCookie(cookie))).status).toBe("authenticated")
    clock = new Date(clock.getTime() + SESSION_IDLE_MS)
    expect((await resolveOperatorIdentity(withCookie(cookie))).status).toBe("unauthenticated")
  })

  it("sign-out revokes server-side and clears the cookie; the old cookie is then worthless", async () => {
    const { cookie } = await signIn()
    const out = await signOutRequest(new Request(`${HTTPS}/api/auth/session`, { method: "DELETE", headers: { origin: HTTPS, host: "app.example.test", cookie: cookie! } }))
    expect(out.status).toBe(200)
    expect(out.setCookie).toMatch(/^__Host-brik_session=; .*Max-Age=0/)
    expect((await resolveOperatorIdentity(withCookie(cookie))).status).toBe("unauthenticated")
    expect([...sessions.rows.values()][0].revokedAt).not.toBeNull()
  })

  it("sign-out from another site is refused (logout CSRF)", async () => {
    const { cookie } = await signIn()
    const out = await signOutRequest(new Request(`${HTTPS}/api/auth/session`, { method: "DELETE", headers: { origin: "https://evil.example", host: "app.example.test", cookie: cookie! } }))
    expect(out.status).toBe(403)
    expect((await resolveOperatorIdentity(withCookie(cookie))).status).toBe("authenticated")
  })

  it("a store failure during sign-out still clears the cookie", async () => {
    __setOperatorAuthDepsForTests({ ...deps(), sessions: { ...sessions, revoke: async () => { throw new Error("db down") } } })
    const out = await signOutRequest(new Request(`${HTTPS}/api/auth/session`, { method: "DELETE", headers: { origin: HTTPS, host: "app.example.test", cookie: "__Host-brik_session=" + "a".repeat(43) } }))
    expect(out.status).toBe(200)
    expect(out.setCookie).toMatch(/Max-Age=0/)
  })

  it("removing the operator from the allowlist ends access on the very next request (membership is re-checked)", async () => {
    const { cookie } = await signIn()
    members = "someone-else"
    __setOperatorAuthDepsForTests(deps())
    expect((await resolveOperatorIdentity(withCookie(cookie))).status).toBe("unauthorized")
  })

  it("fails closed when the session store is down", async () => {
    const { cookie } = await signIn()
    __setOperatorAuthDepsForTests({ ...deps(), sessions: { ...sessions, find: async () => { throw new Error("db down") } } })
    expect((await resolveOperatorIdentity(withCookie(cookie))).status).toBe("unauthenticated")
  })

  it("an Authorization header is authoritative: a bad one is not rescued by a valid cookie", async () => {
    const { cookie } = await signIn()
    const bad = withCookie(cookie, { headers: { authorization: "Bearer not-a-real-token" } })
    expect((await resolveOperatorIdentity(bad)).status).toBe("unauthenticated")
    const good = withCookie(undefined, { headers: { authorization: "Bearer tok-op" } })
    expect(await resolveOperatorIdentity(good)).toMatchObject({ status: "authenticated", credential: "bearer" })
  })

  it("never trusts browser-supplied identity, role or governance hints", async () => {
    const forged = new Request(`${HTTPS}/api/saved-deals`, {
      headers: { "x-user-id": "operator-1", "x-role": "admin", "x-operator-id": "operator-1", "x-forwarded-user": "operator-1", "x-governance-state": "STRONG_OPPORTUNITY", cookie: "role=admin; operator=operator-1" },
    })
    expect((await resolveOperatorIdentity(forged)).status).toBe("unauthenticated")
  })

  it("session id is not readable from a differently-named cookie", () => {
    expect(readSessionId(new Request(HTTPS, { headers: { cookie: "x=1; brik_session=" + "a".repeat(43) } }))).toBe("a".repeat(43))
    expect(readSessionId(new Request(HTTPS, { headers: { cookie: "xbrik_session=" + "a".repeat(43) } }))).toBeNull()
  })
})

describe("CSRF on cookie-authenticated requests", () => {
  const guard = (method: string, headers: Record<string, string>, cookie: string | undefined) =>
    requireSavedDealReadAccess(new Request(`${HTTPS}/api/saved-deals`, { method, headers: { host: "app.example.test", ...(cookie ? { cookie } : {}), ...headers } }), undefined)

  it("rejects a state-changing request from another origin, or with no Origin, when authenticated by cookie", async () => {
    const { cookie } = await signIn()
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(await guard(method, { origin: "https://evil.example" }, cookie), method).toMatchObject({ allowed: false, status: 403, code: "CROSS_ORIGIN_REJECTED" })
      expect(await guard(method, {}, cookie), method).toMatchObject({ allowed: false, status: 403 })
      expect(await guard(method, { origin: "null" }, cookie), method).toMatchObject({ allowed: false, status: 403 })
    }
  })

  it("allows same-origin changes and any reads by cookie", async () => {
    const { cookie } = await signIn()
    expect(await guard("POST", { origin: HTTPS }, cookie)).toMatchObject({ allowed: true })
    expect(await guard("GET", {}, cookie)).toMatchObject({ allowed: true })
    expect(await guard("GET", { origin: "https://evil.example" }, cookie)).toMatchObject({ allowed: true }) // reads change nothing and the response is unreadable cross-site
  })

  it("does not apply to bearer-token requests (credentials are not ambient)", async () => {
    expect(await guard("POST", { authorization: "Bearer tok-op" }, undefined)).toMatchObject({ allowed: true })
  })

  it("an unauthenticated cross-site request is a 401, not a CSRF verdict", async () => {
    expect(await guard("POST", { origin: "https://evil.example" }, undefined)).toMatchObject({ allowed: false, status: 401 })
  })
})

describe("safeNextPath (no open redirect after sign-in)", () => {
  it.each([
    ["/saved-deals/abc/viewing", "/saved-deals/abc/viewing"],
    ["/?x=1", "/?x=1"],
    ["//evil.example", "/"],
    ["https://evil.example", "/"],
    ["/\\evil.example", "/"],
    ["javascript:alert(1)", "/"],
    ["/ok\nSet-Cookie: x=1", "/"],
    [undefined, "/"],
    [42, "/"],
    ["/" + "a".repeat(600), "/"],
  ])("%s", (input, expected) => expect(safeNextPath(input)).toBe(expected))
})

describe("Supabase-style password exchange adapter (mocked network; no project is contacted)", () => {
  const key = makeEcKey()
  const config = { issuer: ISSUER, audience: AUDIENCE, jwksUrl: `${ISSUER}/.well-known/jwks.json` }
  const env = { OPERATOR_PASSWORD_GRANT_URL: `${ISSUER}/token?grant_type=password`, OPERATOR_PASSWORD_GRANT_API_KEY: "test-api-key" }
  const reply = (body: unknown, ok = true) => vi.fn(async () => ({ ok, status: ok ? 200 : 400, json: async () => body }))
  const make = (fetchImpl: ReturnType<typeof reply>, e: Record<string, string | undefined> = env) =>
    createSupabasePasswordExchange(e, config, keyLookup(key), fetchImpl as never, () => NOW)

  it("returns only the verified subject and sends the API key as a header, never in the body", async () => {
    const f = reply({ access_token: signJwt(key, validClaims({ sub: "operator-1" })), refresh_token: "r" })
    const result = await make(f)!.signIn("op@example.test", "pw")
    expect(result).toEqual({ status: "verified", subject: "operator-1" })
    const [url, init] = f.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: string }]
    expect(url).toBe(env.OPERATOR_PASSWORD_GRANT_URL)
    expect(init.headers.apikey).toBe("test-api-key")
    expect(init.body).not.toContain("test-api-key")
  })

  it.each([
    ["provider rejects the login", reply({}, false)],
    ["no access token returned", reply({})],
    ["token signed by an unknown key", reply({ access_token: signJwt(makeEcKey("other"), validClaims()) })],
    ["expired token", reply({ access_token: signJwt(key, validClaims({ exp: NOW - 100 })) })],
    ["wrong audience", reply({ access_token: signJwt(key, validClaims({ aud: "someone-else" })) })],
    ["wrong issuer", reply({ access_token: signJwt(key, validClaims({ iss: "https://evil.example" })) })],
    ["network failure", vi.fn(async () => { throw new Error("offline") })],
  ])("treats %s as an invalid sign-in", async (_n, f) => {
    expect(await make(f as never)!.signIn("op@example.test", "pw")).toEqual({ status: "invalid" })
  })

  it("is not created unless fully and safely configured (https, same origin as the issuer)", () => {
    expect(make(reply({}), {})).toBeNull()
    expect(make(reply({}), { OPERATOR_PASSWORD_GRANT_URL: env.OPERATOR_PASSWORD_GRANT_URL })).toBeNull()
    expect(make(reply({}), { ...env, OPERATOR_PASSWORD_GRANT_URL: "http://example-project.test/auth/v1/token" })).toBeNull()
    expect(make(reply({}), { ...env, OPERATOR_PASSWORD_GRANT_URL: "https://evil.example/token" })).toBeNull()
    expect(make(reply({}), { ...env, OPERATOR_PASSWORD_GRANT_URL: "not a url" })).toBeNull()
  })
})

describe("no privileged shortcut exists in application code", () => {
  const root = path.resolve(__dirname, "..")
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.(ts|tsx)$/.test(name)) files.push(full)
    }
  }
  for (const d of ["app", "lib", "components"]) walk(path.join(root, d))

  it("the only way to bypass the Saved Deals guard is the development-only flag, and it is confined to one module", () => {
    const users = files.filter((f) => /development-open/.test(readFileSync(f, "utf8"))).map((f) => path.relative(root, f).replace(/\\/g, "/"))
    expect(users).toEqual(["lib/operator-command/guard-saved-deal-api.ts"])
  })

  it("the local identity simulator and its certificate trust setting are referenced by no application code", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8")
      expect(src, f).not.toMatch(/idp-simulator|startIdentitySimulator|NODE_EXTRA_CA_CERTS|NODE_TLS_REJECT_UNAUTHORIZED|rejectUnauthorized/)
    }
  })

  it("no application file hard-codes a session cookie value, operator id or token", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8")
      expect(src, f).not.toMatch(/Bearer [A-Za-z0-9._-]{8,}["'`]/)
      expect(src, f).not.toMatch(/brik_session=[A-Za-z0-9_-]{20,}/)
    }
  })

  it("session cookie code never emits a cookie readable by scripts or shared across sites", () => {
    const src = readFileSync(path.join(root, "lib/auth/session.ts"), "utf8")
    expect(src).toContain('"HttpOnly"')
    expect(src).toContain('"SameSite=Lax"')
    expect(src).not.toMatch(/Domain=/i)
    expect(src).not.toMatch(/SameSite=None/i)
  })
})
