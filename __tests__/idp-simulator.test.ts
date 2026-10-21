import { X509Certificate } from "node:crypto"
import { readFileSync } from "node:fs"
import https from "node:https"
import { afterEach, expect, it, vi } from "vitest"
import { startIdentitySimulator } from "../scripts/qa/idp-simulator.mjs"

afterEach(() => vi.unstubAllEnvs())

it("starts without external certificate tooling and serves HTTPS with localhost SANs under scoped trust", async () => {
  vi.stubEnv("PATH", "")
  vi.stubEnv("VIEWING_QA_CONFIRM_ISOLATED", "I_CONFIRM_THIS_IS_NOT_PRODUCTION")
  vi.stubEnv("VERCEL", "")
  vi.stubEnv("VERCEL_ENV", "")

  const simulator = await startIdentitySimulator()
  try {
    const certificate = readFileSync(simulator.caFile)
    const san = new X509Certificate(certificate).subjectAltName ?? ""
    expect(san).toContain("DNS:localhost")
    expect(san).toContain("IP Address:127.0.0.1")

    const response = await new Promise<{ status: number | undefined; body: string }>((resolve, reject) => {
      https
        .get(simulator.jwksUrl, { ca: certificate }, (res) => {
          let body = ""
          res.setEncoding("utf8")
          res.on("data", (chunk) => (body += chunk))
          res.on("end", () => resolve({ status: res.statusCode, body }))
        })
        .on("error", reject)
    })

    expect(response.status).toBe(200)
    expect(JSON.parse(response.body)).toMatchObject({ keys: [{ kid: "sim-1", alg: "ES256" }] })
  } finally {
    await simulator.close()
  }
})
