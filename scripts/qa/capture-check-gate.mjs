// Request gate for the phone capture check. Pure: no I/O. Used by scripts/qa/capture-check.mjs, which puts this in front
// of the application so that, whatever interface it listens on, only the capture-check page and the static files it needs
// can ever be reached. Every API route, every other page, and every non-GET method is refused here, before the application
// sees the request.

export const CAPTURE_PAGE_PATH = "/viewing-capture-check"

/**
 * @param {{ method?: string, url?: string, host?: string }} request
 * @param {{ allowedHosts: readonly string[] }} policy  exact Host header values that are expected (e.g. "localhost:3400")
 * @returns {{ allow: true, forwardPath: string } | { allow: false, status: number, reason: string }}
 */
export function decide(request, policy) {
  const method = (request.method ?? "").toUpperCase()
  if (method !== "GET" && method !== "HEAD") return { allow: false, status: 405, reason: "method not allowed" }

  // DNS-rebinding defence: a page on another site cannot reach this server by pointing a hostname at it.
  if (!request.host || !policy.allowedHosts.includes(request.host.toLowerCase())) {
    return { allow: false, status: 421, reason: "unexpected host" }
  }

  const raw = request.url ?? ""
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return { allow: false, status: 404, reason: "bad path" }
  if (/%2e|%2f|%5c|%00/i.test(raw)) return { allow: false, status: 404, reason: "encoded traversal" }

  let url
  try {
    url = new URL(raw, "http://gate.invalid") // normalises dot segments
  } catch {
    return { allow: false, status: 404, reason: "bad path" }
  }
  const path = url.pathname
  const allowed =
    path === CAPTURE_PAGE_PATH ||
    path === `${CAPTURE_PAGE_PATH}/` ||
    path.startsWith("/_next/static/") ||
    path === "/favicon.ico"
  if (!allowed) return { allow: false, status: 404, reason: "not part of the capture check" }
  return { allow: true, forwardPath: path + url.search }
}

/** RFC 1918 private IPv4 ranges: the only addresses the optional LAN mode will bind to. */
export function isPrivateIPv4(address) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address)
  if (!m) return false
  const [a, b, c, d] = m.slice(1).map(Number)
  if ([a, b, c, d].some((n) => n > 255)) return false
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}
