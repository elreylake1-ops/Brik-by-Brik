import { afterEach, beforeEach } from "vitest"
import { __setOperatorAuthDepsForTests, createAllowlistMembershipStore } from "@/lib/auth/operator-auth"
import { createTestIdentityProvider } from "./auth-fixtures"
import { createInMemorySessionStore } from "./in-memory-session-store"

// TEST-ONLY operator identity for route/page tests. Real authentication code runs; only the identity provider is a
// stand-in (opaque test tokens), and the seam throws outside NODE_ENV=test. Nothing here is importable by app code.

export const OPERATOR_TOKEN = "tok-test-operator"
export const OPERATOR_SUBJECT = "test-operator-1"

export const operatorHeaders = (extra: Record<string, string> = {}): Record<string, string> => ({ authorization: `Bearer ${OPERATOR_TOKEN}`, ...extra })

export function installTestOperator(overrides: { members?: string[]; now?: () => Date; sessions?: ReturnType<typeof createInMemorySessionStore> } = {}) {
  __setOperatorAuthDepsForTests({
    provider: createTestIdentityProvider({ [OPERATOR_TOKEN]: OPERATOR_SUBJECT, "tok-outsider": "outsider-1" }),
    membership: createAllowlistMembershipStore((overrides.members ?? [OPERATOR_SUBJECT]).join(",")) ?? { isActiveOperator: async () => false },
    sessions: overrides.sessions ?? createInMemorySessionStore(),
    now: overrides.now,
  })
}

export function removeTestOperator() {
  __setOperatorAuthDepsForTests(undefined)
}

/** Registers hooks so every test in the file runs as the test operator. */
export function registerTestOperator() {
  beforeEach(() => installTestOperator())
  afterEach(() => removeTestOperator())
}
