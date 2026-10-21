import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { CAPTURE_PAGE_PATH, decide, isPrivateIPv4 } from "../scripts/qa/capture-check-gate.mjs"

const policy = { allowedHosts: ["localhost:3400", "127.0.0.1:3400", "192.168.1.20:3400"] }
const ask = (url: string, over: { method?: string; host?: string } = {}) => decide({ method: "GET", url, host: "localhost:3400", ...over }, policy)

describe("capture check gate: what a phone (or anything else on the network) can reach", () => {
  it("allows the capture page and the static files it needs, and nothing more", () => {
    expect(ask("/viewing-capture-check")).toEqual({ allow: true, forwardPath: "/viewing-capture-check" })
    expect(ask("/viewing-capture-check/")).toMatchObject({ allow: true })
    expect(ask("/viewing-capture-check?x=1")).toEqual({ allow: true, forwardPath: "/viewing-capture-check?x=1" })
    expect(ask("/_next/static/chunks/app-123.js")).toMatchObject({ allow: true })
    expect(ask("/favicon.ico")).toMatchObject({ allow: true })
    expect(CAPTURE_PAGE_PATH).toBe("/viewing-capture-check")
  })

  it.each([
    "/",
    "/api/saved-deals",
    "/api/saved-deals/deal-1/viewing-assessments",
    "/api/saved-deals/deal-1/viewing-assessments/a/evidence/e/image",
    "/saved-deals/deal-1/viewing",
    "/saved-deals/deal-1/review",
    "/phase-3-dev-review",
    "/_next/data/build/index.json",
    "/_next/image?url=/x",
    "/viewing-capture-check-evil",
    "/viewing-capture-checkx",
    "/viewing-capture-check/api",
    "/.env",
    "/package.json",
  ])("refuses %s", (url) => {
    expect(ask(url)).toMatchObject({ allow: false, status: 404 })
  })

  it("refuses path tricks: traversal, encoded slashes and dots, backslashes, double slashes, null bytes", () => {
    for (const url of [
      "/viewing-capture-check/../api/saved-deals",
      "/_next/static/../../api/saved-deals",
      "/_next/static/%2e%2e/api/saved-deals",
      "/_next/static/..%2fapi",
      "/_next/static/%2E%2E%2Fapi",
      "/_next/static/..%5capi",
      "/_next/static\\..\\api",
      "//evil.example/viewing-capture-check",
      "/viewing-capture-check%00.js",
      "api/saved-deals",
      "",
      "http://evil.example/viewing-capture-check",
    ]) {
      expect(ask(url), url).toMatchObject({ allow: false })
    }
  })

  it("resolves dot segments before deciding, so a traversal out of the allowed area is judged by where it lands", () => {
    expect(ask("/_next/static/chunks/../../../api/x")).toMatchObject({ allow: false, status: 404 })
    expect(ask("/viewing-capture-check/./")).toMatchObject({ allow: true })
  })

  it("allows only read methods", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "TRACE", ""]) {
      expect(ask("/viewing-capture-check", { method }), method).toMatchObject({ allow: false, status: 405 })
    }
    expect(ask("/viewing-capture-check", { method: "HEAD" })).toMatchObject({ allow: true })
    expect(ask("/viewing-capture-check", { method: "get" })).toMatchObject({ allow: true })
  })

  it("refuses unexpected Host headers (DNS-rebinding defence), including a missing one", () => {
    for (const host of ["evil.example", "evil.example:3400", "localhost", "localhost:3401", "0.0.0.0:3400", "192.168.1.99:3400", ""]) {
      expect(ask("/viewing-capture-check", { host }), host).toMatchObject({ allow: false, status: 421 })
    }
    expect(decide({ method: "GET", url: "/viewing-capture-check" }, policy)).toMatchObject({ allow: false, status: 421 })
    expect(ask("/viewing-capture-check", { host: "192.168.1.20:3400" })).toMatchObject({ allow: true })
    expect(ask("/viewing-capture-check", { host: "LOCALHOST:3400" })).toMatchObject({ allow: true })
  })
})

describe("private-address check used by the optional Wi-Fi mode", () => {
  it("accepts only RFC 1918 addresses", () => {
    for (const ok of ["10.0.0.5", "10.255.255.255", "172.16.0.1", "172.31.255.254", "192.168.0.1", "192.168.255.255"]) expect(isPrivateIPv4(ok), ok).toBe(true)
    for (const bad of ["0.0.0.0", "127.0.0.1", "8.8.8.8", "172.15.0.1", "172.32.0.1", "192.169.0.1", "169.254.1.1", "100.64.0.1", "300.1.1.1", "10.0.0", "::1", "", "abc"]) expect(isPrivateIPv4(bad), bad).toBe(false)
  })
})

describe("the launcher is structurally unable to expose more than the capture page", () => {
  // code only: the header comments deliberately mention what the launcher never does
  const src = readFileSync(path.resolve(__dirname, "../scripts/qa/capture-check.mjs"), "utf8").replace(/^\s*\/\/.*$/gm, "")

  it("starts the real application on loopback only", () => {
    expect(src).toContain('"-H", "127.0.0.1"')
    expect(src).not.toMatch(/0\.0\.0\.0|"::"|hostname:\s*"0/)
  })

  it("binds its own listener to loopback or one private address, never to all interfaces", () => {
    expect(src).toContain('listenOn(lanAddress ?? "127.0.0.1")')
    expect(src).not.toMatch(/\.listen\(\s*FRONT_PORT\s*\)/)
  })

  it("blanks every database and paid-service variable for the application it starts", () => {
    for (const name of ["FORBIDDEN_ENV", "ANTHROPIC_API_KEY", "VIEWING_AI_ENABLED", "OPERATOR_AUTH_MODE"]) expect(src).toContain(name)
    expect(src).toContain("...blanked")
  })

  it("routes every request through the gate and never opens a public tunnel", () => {
    expect(src).toContain("decide(")
    expect(src).not.toMatch(/ngrok|cloudflared|localtunnel|serveo|tailscale funnel|--host\s+0/i)
  })

  it("refuses duplicate servers before building and rebuilds only when capture inputs changed", () => {
    expect(src).toContain("ensurePortsAvailable")
    expect(src.indexOf("await ensurePortsAvailable")).toBeLessThan(src.indexOf("spawnSync(process.execPath, [nextBin, \"build\"]"))
    expect(src).toContain("CAPTURE_CHECK_COMMIT")
    expect(src).toContain("latestCaptureSourceMtime")
    expect(src).toContain("VIEWING_CAPTURE_BUILD_REF")
  })
})
