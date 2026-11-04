// Same-origin CSRF verification for state-changing browser requests (cookies)

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

export function isStateChanging(request: Request): boolean {
  return STATE_CHANGING_METHODS.has(request.method.toUpperCase())
}

let testTrustedOrigins: string[] | null | undefined

export function __setTrustedOriginsForTests(origins: string[] | null | undefined): void {
  testTrustedOrigins = origins
}

export function getTrustedOrigins(env: Record<string, string | undefined> = process.env): Set<string> {
  if (testTrustedOrigins !== undefined) {
    if (testTrustedOrigins === null) return new Set()
    return new Set(testTrustedOrigins)
  }

  const trusted = new Set<string>()
  const rawConfigs = [
    env.TRUSTED_ORIGINS,
    env.OPERATOR_TRUSTED_ORIGINS,
    env.APP_ORIGIN,
    env.NEXT_PUBLIC_APP_URL,
    env.APP_URL,
  ]

  for (const raw of rawConfigs) {
    if (!raw) continue
    for (const candidate of raw.split(",")) {
      const trimmed = candidate.trim()
      if (!trimmed) continue
      try {
        const parsed = new URL(trimmed)
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          trusted.add(parsed.origin.toLowerCase())
        }
      } catch {
        // ignore invalid URL
      }
    }
  }

  return trusted
}

export function isSameOrigin(request: Request, env: Record<string, string | undefined> = process.env): boolean {
  const originHeader = request.headers.get("origin")?.trim()

  if (!originHeader || originHeader === "null") {
    return false
  }

  let requestOrigin: string
  try {
    const parsed = new URL(originHeader)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false
    }
    requestOrigin = parsed.origin.toLowerCase()
  } catch {
    return false
  }

  const trustedOrigins = getTrustedOrigins(env)
  if (trustedOrigins.size === 0) {
    // Fail closed when trusted origins are missing or unconfigured
    return false
  }

  return trustedOrigins.has(requestOrigin)
}

