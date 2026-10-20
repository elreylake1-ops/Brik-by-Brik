import type { JsonWebKey } from "node:crypto"

// JWKS key provider for the configured issuer. Fetching is the only network use in the auth boundary and
// is injectable (tests never touch the network). Only https, bounded size/time, cached, and refetched
// at most once per REFRESH_FLOOR_MS when an unknown kid arrives (key rotation) so a flood of bad tokens
// cannot turn into a flood of outbound requests.

export type KeyProvider = (kid: string) => Promise<JsonWebKey | null>

export type JwksOptions = {
  url: string
  fetchImpl?: typeof fetch
  nowMs?: () => number
  cacheTtlMs?: number
  refreshFloorMs?: number
  timeoutMs?: number
}

const MAX_JWKS_BYTES = 64 * 1024

export function createJwksKeyProvider(options: JwksOptions): KeyProvider {
  const { url } = options
  if (new URL(url).protocol !== "https:") throw new Error("JWKS URL must be https")
  const doFetch = options.fetchImpl ?? fetch
  const nowMs = options.nowMs ?? Date.now
  const ttl = options.cacheTtlMs ?? 10 * 60_000
  const floor = options.refreshFloorMs ?? 60_000
  const timeout = options.timeoutMs ?? 3_000

  let keys = new Map<string, JsonWebKey>()
  let fetchedAt = -Infinity
  let attemptedAt = -Infinity

  async function refresh(): Promise<void> {
    attemptedAt = nowMs()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const res = await doFetch(url, { signal: controller.signal, redirect: "error", headers: { accept: "application/json" } })
      if (!res.ok) return
      const text = await res.text()
      if (text.length > MAX_JWKS_BYTES) return
      const body: unknown = JSON.parse(text)
      const list = (body as { keys?: unknown })?.keys
      if (!Array.isArray(list)) return
      const next = new Map<string, JsonWebKey>()
      for (const k of list as (JsonWebKey & { kid?: unknown })[]) {
        if (k && typeof k === "object" && typeof k.kid === "string" && k.kid) next.set(k.kid, k)
      }
      keys = next
      fetchedAt = nowMs()
    } catch {
      // Network/parse failure: keep serving the previous keys until their TTL lapses; never throw to callers.
    } finally {
      clearTimeout(timer)
    }
  }

  return async (kid) => {
    const now = nowMs()
    if (now - fetchedAt > ttl && now - attemptedAt >= floor) await refresh()
    let key = keys.get(kid)
    if (!key && now - attemptedAt >= floor) {
      await refresh() // unknown kid: maybe rotated
      key = keys.get(kid)
    }
    // Expired cache with a failed refresh must not keep trusting stale keys indefinitely.
    if (key && nowMs() - fetchedAt > ttl * 3) return null
    return key ?? null
  }
}
