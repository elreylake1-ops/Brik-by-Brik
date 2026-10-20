// Identity and safety guard for the disposable local QA Postgres. Pure: no I/O, no network, no secrets.
// Used by scripts/qa/local-postgres.mjs and by __tests__/postgres/*, so the tool that creates the database and
// the tests that write to it enforce the SAME definition of "the only database we are allowed to touch".

export const LOCAL_QA = Object.freeze({
  container: "brik-viewing-qa-pg",
  label: "brik.qa=viewing-local",
  image: "postgres:16-alpine", // pin by digest before relying on it for anything but local QA
  host: "127.0.0.1",
  port: 54339, // 54329 is held by an unrelated project's database on this machine (see Task 3C)
  database: "brik_viewing_qa_local",
  user: "brik_qa",
})

// Environment variables that, in this project, may hold real (Supabase/Production/Preview) connection strings.
export const FORBIDDEN_ENV = Object.freeze([
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_PRISMA_URL",
  "SUPABASE_DB_URL",
])

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"])

/**
 * Throws unless `urlString` is exactly the local disposable QA database. Messages never echo the URL.
 * @param {string} urlString
 * @param {Record<string, string | undefined>} [env]
 */
export function assertLocalQaTarget(urlString, env = process.env) {
  const reject = (rule) => {
    throw new Error(`QA target rejected: ${rule}`)
  }
  if (typeof urlString !== "string" || urlString.length === 0 || urlString.length > 512) reject("missing or oversized URL")

  let url
  try {
    url = new URL(urlString)
  } catch {
    return reject("not a parsable URL")
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") reject("not a postgres URL")
  if (!LOOPBACK_HOSTS.has(url.hostname)) reject("host is not loopback")
  if (url.port !== String(LOCAL_QA.port)) reject("port is not the local QA port")
  if (decodeURIComponent(url.pathname.replace(/^\//, "")) !== LOCAL_QA.database) reject("database name is not the local QA database")
  if (decodeURIComponent(url.username) !== LOCAL_QA.user) reject("user is not the local QA user")
  // pg-connection-string lets query parameters (host=, hostaddr=, sslmode=, options=) override the URL itself.
  if (url.search !== "" || url.hash !== "") reject("query parameters are not allowed")
  if (/supabase|pooler|\.co\b|\.com\b|\.io\b/i.test(urlString)) reject("looks like a hosted database")

  for (const name of FORBIDDEN_ENV) {
    const other = env[name]
    if (!other) continue
    if (other === urlString) reject("identical to a configured application database URL")
    let sameTarget = false
    try {
      const o = new URL(other)
      sameTarget = o.hostname === url.hostname && o.port === url.port && o.pathname === url.pathname
    } catch {
      // unparsable value in an env var: irrelevant to this comparison
    }
    if (sameTarget) reject("same host, port and database as a configured application database URL")
  }
  return { host: url.hostname, port: Number(url.port), database: LOCAL_QA.database, user: LOCAL_QA.user }
}

/** @param {string} password */
export function buildLocalQaUrl(password) {
  return `postgres://${LOCAL_QA.user}:${encodeURIComponent(password)}@${LOCAL_QA.host}:${LOCAL_QA.port}/${LOCAL_QA.database}`
}

/**
 * Environment for child processes: everything except variables that could carry a real database URL.
 * @param {Record<string, string | undefined>} [env]
 */
export function scrubbedEnv(env = process.env) {
  const copy = { ...env }
  for (const name of FORBIDDEN_ENV) delete copy[name]
  return copy
}

/**
 * Names of containers OTHER than ours that publish `port` on the host, from lines of
 * `docker ps -a --format "{{.Names}}|{{.Ports}}"`. A different container on our port means the address in
 * the QA URL would reach someone else's database, so the tooling must refuse to continue.
 * @param {string[]} lines
 * @param {number} [port]
 * @param {string} [ourName]
 */
export function findPortConflicts(lines, port = LOCAL_QA.port, ourName = LOCAL_QA.container) {
  const hostSide = new RegExp(String.raw`(?:^|[\s,])(?:\d{1,3}(?:\.\d{1,3}){3}|\[[0-9a-fA-F:]*\]):${port}->`)
  return lines
    .map((line) => line.split("|"))
    .filter(([name, ports]) => name && name !== ourName && hostSide.test(ports ?? ""))
    .map(([name]) => name)
}
