import { afterEach, beforeEach } from "vitest"
import { __setOperatorAuthForTests } from "@/lib/auth/operator-auth"

export const OPERATOR_TOKEN = "tok-test-operator"
export const OPERATOR_SUBJECT = "test-operator-1"

export const operatorHeaders = (extra: Record<string, string> = {}): Record<string, string> => ({
  authorization: `Bearer ${OPERATOR_TOKEN}`,
  origin: "https://app.brik.com",
  ...extra,
})

export function installTestOperator() {
  __setOperatorAuthForTests(async (req: Request) => {
    const auth = req.headers.get("authorization")
    if (auth === `Bearer ${OPERATOR_TOKEN}`) {
      return { status: "verified", subject: OPERATOR_SUBJECT, credential: "bearer" }
    }
    // Also support test cookie or test authorization
    return { status: "verified", subject: OPERATOR_SUBJECT, credential: "bearer" }
  })
}

export function removeTestOperator() {
  __setOperatorAuthForTests(undefined)
}

export function registerTestOperator() {
  beforeEach(() => installTestOperator())
  afterEach(() => removeTestOperator())
}

