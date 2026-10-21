// TEST-ONLY local identity-provider simulator for the Brik-by-Brik sign-in rehearsal. Never part of the application.
//
// Implements just the contract the real sign-in adapter uses:
//   GET  /.well-known/jwks.json        public key set (ES256)
//   POST /token?grant_type=password    header `apikey`, body {email, password} -> {access_token, refresh_token}
// served over HTTPS on 127.0.0.1 with a throw-away certificate. The application child process trusts that one certificate
// through NODE_EXTRA_CA_CERTS (scoped to the child only); TLS verification is never disabled anywhere.
//
// Why it cannot run, or be trusted, in Production or Preview:
//   - it refuses to start if VERCEL / VERCEL_ENV is set, or unless the QA confirmation variable is present;
//   - it binds 127.0.0.1 only;
//   - its identities, passwords and API key are random per run and never written to disk (only the public certificate
//     is, in a temporary folder that is deleted on close);
//   - the application refuses a loopback issuer whenever VERCEL / VERCEL_ENV is set (lib/auth/operator-auth.ts), and the
//     issuer is simply unreachable from any hosted environment.
//
// Controlled behaviours, selected by the email used:
//   operator@qa.test   valid account, enrolled operator
//   stranger@qa.test   valid account in the "shared project" that is NOT an enrolled operator
//   expired@qa.test    correct password, but the token it returns is already expired
//   badsig@qa.test     correct password, token signed by a different key under the same key id
//   wrongaud@qa.test   correct password, token for another audience

import { createPrivateKey, generateKeyPairSync, randomBytes, sign } from "node:crypto"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import https from "node:https"
import path from "node:path"
import { fileURLToPath } from "node:url"
import selfsigned from "selfsigned"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
export const SIM_AUDIENCE = "authenticated"
const KID = "sim-1"
const b64 = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url")

function signJwt(privateKey, claims) {
  const input = `${b64({ alg: "ES256", kid: KID, typ: "JWT" })}.${b64(claims)}`
  return `${input}.${sign("sha256", Buffer.from(input), { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url")}`
}

export async function startIdentitySimulator() {
  if (process.env.VERCEL || process.env.VERCEL_ENV) throw new Error("The identity simulator refuses to run in a hosted environment.")
  if (process.env.VIEWING_QA_CONFIRM_ISOLATED !== "I_CONFIRM_THIS_IS_NOT_PRODUCTION") throw new Error("The identity simulator runs only inside the confirmed local QA harness.")

  const dir = mkdtempSync(path.join(root, ".qa-local", "idp-"))
  const certFile = path.join(dir, "cert.pem")
  const notBeforeDate = new Date(Date.now() - 60_000)
  const notAfterDate = new Date(Date.now() + 86_400_000)
  const { private: tlsPrivateKey, cert: tlsCertificate } = await selfsigned.generate(
    [{ name: "commonName", value: "localhost" }],
    {
      keyType: "ec",
      curve: "P-256",
      algorithm: "sha256",
      notBeforeDate,
      notAfterDate,
      extensions: [
        { name: "basicConstraints", cA: false, critical: true },
        { name: "keyUsage", digitalSignature: true, keyEncipherment: true, critical: true },
        { name: "extKeyUsage", serverAuth: true },
        { name: "subjectAltName", altNames: [{ type: 2, value: "localhost" }, { type: 7, ip: "127.0.0.1" }] },
      ],
    }
  )
  // Only the public certificate is written for NODE_EXTRA_CA_CERTS. The generated private key stays in memory.
  writeFileSync(certFile, tlsCertificate, { mode: 0o600 })

  const good = generateKeyPairSync("ec", { namedCurve: "P-256" })
  const other = generateKeyPairSync("ec", { namedCurve: "P-256" })
  const jwk = { ...good.publicKey.export({ format: "jwk" }), kid: KID, alg: "ES256", use: "sig" }
  const rand = (n) => randomBytes(n).toString("hex")

  const accounts = {
    "operator@qa.test": { password: rand(12), subject: `sim-operator-${rand(6)}` },
    "stranger@qa.test": { password: rand(12), subject: `sim-stranger-${rand(6)}` },
    "expired@qa.test": { password: rand(12), subject: `sim-expired-${rand(6)}` },
    "badsig@qa.test": { password: rand(12), subject: `sim-badsig-${rand(6)}` },
    "wrongaud@qa.test": { password: rand(12), subject: `sim-wrongaud-${rand(6)}` },
  }
  const apiKey = `sim-key-${rand(12)}`
  const issued = [] // every secret this simulator hands out, so tests can prove none of it reaches a browser
  let issuer = ""

  const server = https.createServer({ key: tlsPrivateKey, cert: tlsCertificate }, (req, res) => {
    const url = new URL(req.url ?? "/", "https://localhost")
    const send = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" })
      res.end(JSON.stringify(body))
    }
    if (req.method === "GET" && url.pathname === "/.well-known/jwks.json") return send(200, { keys: [jwk] })
    if (req.method === "POST" && url.pathname === "/token" && url.searchParams.get("grant_type") === "password") {
      if (req.headers.apikey !== apiKey) return send(401, { error: "invalid_api_key" })
      let raw = ""
      req.on("data", (c) => (raw += c))
      req.on("end", () => {
        let email, password
        try {
          ;({ email, password } = JSON.parse(raw))
        } catch {
          return send(400, { error: "bad_json" })
        }
        const account = accounts[email]
        if (!account || account.password !== password) return send(400, { error: "invalid_grant" })
        const now = Math.floor(Date.now() / 1000)
        const claims = { iss: issuer, aud: SIM_AUDIENCE, sub: account.subject, iat: now, exp: now + 3600, role: "authenticated" }
        if (email === "expired@qa.test") Object.assign(claims, { iat: now - 7200, exp: now - 3600 })
        if (email === "wrongaud@qa.test") claims.aud = "another-audience"
        const key = createPrivateKey(email === "badsig@qa.test" ? other.privateKey.export({ type: "pkcs8", format: "pem" }) : good.privateKey.export({ type: "pkcs8", format: "pem" }))
        const access = signJwt(key, claims)
        const refresh = `sim-refresh-${rand(16)}`
        issued.push(access, refresh)
        send(200, { access_token: access, refresh_token: refresh, token_type: "bearer", expires_in: 3600 })
      })
      return
    }
    send(404, { error: "not_found" })
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const port = server.address().port
  issuer = `https://localhost:${port}`

  return {
    issuer,
    audience: SIM_AUDIENCE,
    jwksUrl: `${issuer}/.well-known/jwks.json`,
    grantUrl: `${issuer}/token?grant_type=password`,
    apiKey,
    caFile: certFile,
    accounts,
    issued,
    async close() {
      await new Promise((resolve) => server.close(resolve))
      rmSync(dir, { recursive: true, force: true })
    },
  }
}
