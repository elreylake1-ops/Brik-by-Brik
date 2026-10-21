import type { SessionRecord, SessionStore } from "@/lib/auth/session"

export function createInMemorySessionStore(): SessionStore & { rows: Map<string, SessionRecord> } {
  const rows = new Map<string, SessionRecord>()
  return {
    rows,
    async create({ idHash, subject, now, expiresAt }) {
      if (rows.has(idHash)) throw new Error("duplicate session")
      rows.set(idHash, { subject, createdAt: now, lastSeenAt: now, expiresAt, revokedAt: null })
    },
    async find(idHash) {
      const r = rows.get(idHash)
      return r ? { ...r } : null
    },
    async touch(idHash, now) {
      const r = rows.get(idHash)
      if (r && !r.revokedAt && r.lastSeenAt < now) r.lastSeenAt = now
    },
    async revoke(idHash, now) {
      const r = rows.get(idHash)
      if (r && !r.revokedAt) r.revokedAt = now
    },
  }
}
