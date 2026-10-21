import { describe, it } from "vitest"
import { assertLocalQaTarget } from "../../scripts/qa/local-qa-target.mjs"

// One definition of "may this test touch a database?" for every Postgres suite. It can ONLY run against the
// disposable local QA database defined in scripts/qa/local-qa-target.mjs (loopback host, the QA port, database
// brik_viewing_qa_local, user brik_qa, no URL query parameters, never the application's own database URL).
//
//   VIEWING_QA_DATABASE_URL unset                    -> the suite is skipped (normal test runs)
//   set, but not the local QA target / unconfirmed   -> a FAILING test that names the rule, so a wrong URL can never
//                                                       silently run (and never prints the URL)
//   set, valid, and VIEWING_QA_CONFIRM_ISOLATED set  -> runs
// Drive it with: node scripts/qa/local-postgres.mjs test   (after `up` and `migrate`)

export function qaGate(label: string) {
  const url = process.env.VIEWING_QA_DATABASE_URL
  let guardError: string | null = null
  if (url) {
    try {
      assertLocalQaTarget(url, process.env)
    } catch (error) {
      guardError = (error as Error).message
    }
  }
  const confirmed = process.env.VIEWING_QA_CONFIRM_ISOLATED === "I_CONFIRM_THIS_IS_NOT_PRODUCTION"
  const enabled = Boolean(url) && !guardError && confirmed

  if (url && (guardError || !confirmed)) {
    describe(`${label}: target refused`, () => {
      it("refuses to run against anything but the confirmed local QA database", () => {
        throw new Error(guardError ?? "VIEWING_QA_CONFIRM_ISOLATED is not set to the required confirmation value")
      })
    })
  }
  return { url: url as string, enabled }
}
