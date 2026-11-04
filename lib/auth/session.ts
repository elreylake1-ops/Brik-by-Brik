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
    requestOrigin = new URL(originHeader).origin.toLowerCase()
  } catch {
    return false
  }

  const trustedOrigins = getTrustedOrigins(env)
  if (trustedOrigins.size > 0) {
    return trustedOrigins.has(requestOrigin)
  }

  // Fallback for local development if no explicit TRUSTED_ORIGINS configured
  const isHosted = Boolean(env.VERCEL || env.VERCEL_ENV || env.NEXT_PUBLIC_VERCEL_ENV || env.NODE_ENV === "production")
  if (isHosted) {
    return false // Fail closed in hosted environments
  }

  try {
    const host = request.headers.get("host")?.trim()
    if (!host) return false
    const hostOrigin = new URL(`http://${host}`).origin.toLowerCase()
    return requestOrigin === hostOrigin
  } catch {
    return false
  }
}

