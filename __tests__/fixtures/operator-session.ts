import { afterEach, beforeEach } from "vitest"
import { __setOperatorAuthForTests } from "@/lib/auth/operator-auth"
import { __setTrustedOriginsForTests } from "@/lib/auth/session"

export const OPERATOR_TOKEN = "tok-test-operator"
export const OPERATOR_SUBJECT = "test-operator-1"
export const TRUSTED_TEST_ORIGIN = "https://app.brik.com"

export const operatorHeaders = (extra: Record<string, string> = {}): Record<string, string> => ({
  authorization: `Bearer ${OPERATOR_TOKEN}`,
  origin: TRUSTED_TEST_ORIGIN,
  ...extra,
})

export function installTestOperator() {
  __setTrustedOriginsForTests([TRUSTED_TEST_ORIGIN])
  __setOperatorAuthForTests(async (req: Request) => {
    const auth = req.headers.get("authorization")
    if (auth) {
      if (auth === `Bearer ${OPERATOR_TOKEN}`) {
        return { status: "verified", subject: OPERATOR_SUBJECT, credential: "bearer" }
      }
      return { status: "unauthenticated" }
    }

    const cookie = req.headers.get("cookie")
    if (cookie && (cookie.includes("sb-") || cookie.includes("test-session"))) {
      return { status: "verified", subject: OPERATOR_SUBJECT, credential: "cookie" }
    }

    // Default for server component tests that simulate active operator
    return { status: "verified", subject: OPERATOR_SUBJECT, credential: "bearer" }
  })
}

export function removeTestOperator() {
  __setOperatorAuthForTests(undefined)
  __setTrustedOriginsForTests(undefined)
}

export function registerTestOperator() {
  beforeEach(() => installTestOperator())
  afterEach(() => removeTestOperator())
}

