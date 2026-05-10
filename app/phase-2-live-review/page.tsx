import type { Metadata } from "next"
import { loadPhase2Fixtures } from "@/lib/validation/load-phase2-fixtures"
import { runPhase2Validation } from "@/lib/validation/run-phase2-validation"
import type {
  Phase2EdgeCaseValidationResult,
  Phase2GovernanceOverrideValidationResult,
  Phase2ScenarioFixture,
  Phase2ScenarioValidationResult,
} from "@/types/phase2-validation"

export const metadata: Metadata = {
  title: "Phase 2 Live Scenario Review — Brik Engine v1",
  description:
    "Live read-only execution of the deterministic Phase 2 engine against the locked 15-scenario stress suite.",
}

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type LiveScenarioResult = {
  fixture: Phase2ScenarioFixture
  result: Phase2ScenarioValidationResult
  scenarioNumber: string
  whatThisProves: string
}

function formatBoolean(value: boolean): string {
  return value ? "Yes" : "No"
}

function resultToneClasses(pass: boolean): string {
  return pass
    ? "border-green-200 bg-green-50 text-green-800"
    : "border-red-200 bg-red-50 text-red-800"
}

function stateToneClasses(state: string): string {
  if (state === "BLOCKED" || state === "NO_DEAL") {
    return "border-red-200 bg-red-50 text-red-800"
  }

  if (state === "REVIEW_REQUIRED") {
    return "border-amber-200 bg-amber-50 text-amber-800"
  }

  return "border-green-200 bg-green-50 text-green-800"
}

function renderRiskFlags(flags: string[]) {
  if (flags.length === 0) {
    return <span className="text-sm text-gray-500">None</span>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {flags.map((flag) => (
        <span
          key={flag}
          className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700"
        >
          {flag}
        </span>
      ))}
    </div>
  )
}

function renderFailures(failures: string[]) {
  if (failures.length === 0) {
    return <p className="text-sm text-gray-600">None</p>
  }

  return (
    <ul className="space-y-2 text-sm text-red-700">
      {failures.map((failure) => (
        <li key={failure} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          {failure}
        </li>
      ))}
    </ul>
  )
}

function buildWhatThisProves(
  fixture: Phase2ScenarioFixture,
  governanceOverride?: Phase2GovernanceOverrideValidationResult,
  edgeCase?: Phase2EdgeCaseValidationResult
): string {
  if (governanceOverride) {
    return governanceOverride.explanation
  }

  if (edgeCase) {
    return edgeCase.explanation
  }

  return fixture.description
}

function ScenarioCard({
  scenario,
}: {
  scenario: LiveScenarioResult
}) {
  const { fixture, result, scenarioNumber, whatThisProves } = scenario
  const actual = result.actual

  return (
    <section
      id={`scenario-${scenarioNumber}`}
      className="scroll-mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
            Scenario {scenarioNumber}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-gray-900">{result.name}</h2>
          <p className="mt-2 text-sm text-gray-500">{fixture.description}</p>
        </div>
        <div
          className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${resultToneClasses(result.pass)}`}
        >
          {result.pass ? "PASS" : "FAIL"}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">Expected Governance</div>
          <div className="mt-1 text-sm font-semibold text-gray-900">
            {result.expected.governanceState}
          </div>
        </div>
        <div
          className={`rounded-xl border p-3 ${stateToneClasses(actual?.governanceState ?? "UNKNOWN")}`}
        >
          <div className="text-xs uppercase tracking-wide opacity-80">Actual Governance</div>
          <div className="mt-1 text-sm font-semibold">{actual?.governanceState ?? "N/A"}</div>
        </div>
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">Expected Final</div>
          <div className="mt-1 text-sm font-semibold text-gray-900">
            {result.expected.finalClassification}
          </div>
        </div>
        <div
          className={`rounded-xl border p-3 ${stateToneClasses(actual?.finalClassification ?? "UNKNOWN")}`}
        >
          <div className="text-xs uppercase tracking-wide opacity-80">Actual Final</div>
          <div className="mt-1 text-sm font-semibold">{actual?.finalClassification ?? "N/A"}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">Raw Heat</div>
          <div className="mt-1 text-sm font-semibold text-gray-900">
            {actual ? `${actual.rawHeatScore} / ${actual.rawHeatBand}` : "N/A"}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">Strategy Outcome</div>
          <div className="mt-1 text-sm font-semibold text-gray-900">
            {actual?.strategyOutcome ?? "N/A"}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">Next Action</div>
          <div className="mt-1 text-sm font-semibold text-gray-900">
            {actual?.nextAction ?? "N/A"}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">Review / Fatal</div>
          <div className="mt-1 text-sm font-semibold text-gray-900">
            Review Required: {formatBoolean(actual?.reviewRequired ?? false)}
          </div>
          <div className="mt-1 text-sm font-semibold text-gray-900">
            Fatal Risk: {formatBoolean(actual?.fatalRisk ?? false)}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Risk Flags</div>
          <div className="mt-3">{renderRiskFlags(actual?.riskFlags ?? [])}</div>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Fixture Expectations</div>
          <div className="mt-3 space-y-2 text-sm text-gray-700">
            <p>Expected next action: {result.expected.nextAction}</p>
            <p>Expected strategy outcome: {result.expected.strategyOutcome}</p>
            <p>Expected review required: {formatBoolean(result.expected.reviewRequired)}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Failures</div>
          <div className="mt-3">{renderFailures(result.failures)}</div>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">What This Proves</div>
          <p className="mt-3 text-sm text-gray-700">{whatThisProves}</p>
          {fixture.notes.length > 0 && (
            <div className="mt-3 space-y-2 text-sm text-gray-600">
              {fixture.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default function Phase2LiveReviewPage() {
  const renderedAt = new Date().toISOString()
  const fixtures = loadPhase2Fixtures()
  const validationRun = runPhase2Validation(fixtures)

  const fixtureMap = new Map(fixtures.map((fixture) => [fixture.scenarioId, fixture]))
  const governanceExplanationMap = new Map(
    validationRun.governanceOverrideResults.map((entry) => [entry.scenarioId, entry])
  )
  const edgeCaseExplanationMap = new Map(
    validationRun.edgeCaseResults.map((entry) => [entry.scenarioId, entry])
  )

  const liveScenarios: LiveScenarioResult[] = validationRun.scenarioResults.map((result, index) => {
    const fixture = fixtureMap.get(result.scenarioId)

    if (!fixture) {
      throw new Error(`Missing Phase 2 fixture for scenario ${result.scenarioId}.`)
    }

    return {
      fixture,
      result,
      scenarioNumber: String(index + 1).padStart(2, "0"),
      whatThisProves: buildWhatThisProves(
        fixture,
        governanceExplanationMap.get(result.scenarioId),
        edgeCaseExplanationMap.get(result.scenarioId)
      ),
    }
  })

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
            Live Validation Route
          </p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Phase 2 Live Scenario Review</h1>
          <p className="mt-2 text-sm text-gray-500">
            Live read-only execution of the deterministic Phase 2 engine against the locked
            15-scenario stress suite.
          </p>
          <p className="mt-3 text-sm text-gray-600">
            This page runs the actual Phase 2 engine using locked validation fixtures. It is
            separate from the basic calculator form because several governance scenarios require
            evidence and risk fields not exposed as normal calculator inputs.
          </p>
        </div>

        <div className="mb-8 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-900 shadow-sm">
          <p className="text-sm font-semibold">Screenshot Guidance</p>
          <p className="mt-2 text-sm leading-6">
            Use this route for official live-behavior screenshots of the 15 locked scenarios. The
            existing <code className="rounded bg-white px-1 py-0.5 text-xs">/phase-2-review</code>
            route remains the saved report viewer and the normal calculator remains the manual deal
            analysis form.
          </p>
        </div>

        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500">Total Scenarios</div>
            <div className="mt-1 text-xl font-semibold text-gray-900">
              {validationRun.totalScenarios}
            </div>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-800 shadow-sm">
            <div className="text-xs uppercase tracking-wide opacity-80">Passed</div>
            <div className="mt-1 text-xl font-semibold">{validationRun.passed}</div>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-sm">
            <div className="text-xs uppercase tracking-wide opacity-80">Failed</div>
            <div className="mt-1 text-xl font-semibold">{validationRun.failed}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500">Rendered At</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">{renderedAt}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500">Engine Version</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">
              {validationRun.engineVersion}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500">Source</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">Live engine execution</div>
          </div>
        </div>

        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {liveScenarios.map((scenario) => (
              <a
                key={scenario.result.scenarioId}
                href={`#scenario-${scenario.scenarioNumber}`}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                {scenario.scenarioNumber} {scenario.result.name}
              </a>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {liveScenarios.map((scenario) => (
            <ScenarioCard key={scenario.result.scenarioId} scenario={scenario} />
          ))}
        </div>
      </div>
    </main>
  )
}
