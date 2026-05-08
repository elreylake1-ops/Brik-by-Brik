import type { Metadata } from "next"
import phase2StressTestResults from "@/docs/validation/phase2-stress-test-results.json"

export const metadata: Metadata = {
  title: "Phase 2 Scenario Review — Brik Engine v1",
  description:
    "Read-only client review page showing validated Phase 2 stress-test outputs without running new calculations.",
}

type ScenarioResult = (typeof phase2StressTestResults.scenarioResults)[number]
type GovernanceOverrideResult = (typeof phase2StressTestResults.governanceOverrideResults)[number]
type EdgeCaseResult = (typeof phase2StressTestResults.edgeCaseResults)[number]

const scenarioResults = phase2StressTestResults.scenarioResults
const governanceOverrideResults = phase2StressTestResults.governanceOverrideResults
const edgeCaseResults = phase2StressTestResults.edgeCaseResults

const governanceExplanationMap = new Map<string, GovernanceOverrideResult>(
  governanceOverrideResults.map((entry) => [entry.scenarioId, entry])
)

const edgeCaseExplanationMap = new Map<string, EdgeCaseResult>(
  edgeCaseResults.map((entry) => [entry.scenarioId, entry])
)

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

function getScenarioExplanation(result: ScenarioResult): string {
  const governanceExplanation = governanceExplanationMap.get(result.scenarioId)
  if (governanceExplanation) {
    return governanceExplanation.explanation
  }

  const edgeCaseExplanation = edgeCaseExplanationMap.get(result.scenarioId)
  if (edgeCaseExplanation) {
    return edgeCaseExplanation.explanation
  }

  if (result.failures.length > 0) {
    return result.failures.join(" ")
  }

  return "Validated actual output matched the expected deterministic Phase 2 scenario result."
}

function ScenarioCard({
  result,
  scenarioNumber,
}: {
  result: ScenarioResult
  scenarioNumber: string
}) {
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
          <p className="mt-2 text-sm text-gray-500">
            Read-only validation output from the deterministic Phase 2 stress suite.
          </p>
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
          <div className="mt-1 text-sm font-semibold text-gray-900">{result.expected.governanceState}</div>
        </div>
        <div className={`rounded-xl border p-3 ${stateToneClasses(result.actual.governanceState)}`}>
          <div className="text-xs uppercase tracking-wide opacity-80">Actual Governance</div>
          <div className="mt-1 text-sm font-semibold">{result.actual.governanceState}</div>
        </div>
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">Expected Final</div>
          <div className="mt-1 text-sm font-semibold text-gray-900">{result.expected.finalClassification}</div>
        </div>
        <div className={`rounded-xl border p-3 ${stateToneClasses(result.actual.finalClassification)}`}>
          <div className="text-xs uppercase tracking-wide opacity-80">Actual Final</div>
          <div className="mt-1 text-sm font-semibold">{result.actual.finalClassification}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">Raw Heat</div>
          <div className="mt-1 text-sm font-semibold text-gray-900">
            {result.actual.rawHeatScore} / {result.actual.rawHeatBand}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">Strategy Outcome</div>
          <div className="mt-1 text-sm font-semibold text-gray-900">{result.actual.strategyOutcome}</div>
        </div>
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">Next Action</div>
          <div className="mt-1 text-sm font-semibold text-gray-900">{result.actual.nextAction}</div>
        </div>
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">Review / Fatal</div>
          <div className="mt-1 text-sm font-semibold text-gray-900">
            Review Required: {formatBoolean(result.actual.reviewRequired)}
          </div>
          <div className="mt-1 text-sm font-semibold text-gray-900">
            Fatal Risk: {formatBoolean(result.actual.fatalRisk)}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-gray-200 p-4">
        <div className="text-xs uppercase tracking-wide text-gray-500">Risk Flags</div>
        <div className="mt-3">{renderRiskFlags(result.actual.riskFlags)}</div>
      </div>

      <div className="mt-5 rounded-xl border border-gray-200 p-4">
        <div className="text-xs uppercase tracking-wide text-gray-500">Explanation</div>
        <p className="mt-2 text-sm text-gray-700">{getScenarioExplanation(result)}</p>
      </div>
    </section>
  )
}

export default function Phase2ReviewPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
            Client Review Route
          </p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Phase 2 Scenario Review</h1>
          <p className="mt-2 text-sm text-gray-500">
            Read-only validation output from the deterministic Phase 2 stress test suite.
          </p>
          <p className="mt-3 text-sm text-gray-600">
            This page displays validated Phase 2 scenario outputs for client review. It does not run new calculations.
          </p>
        </div>

        <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm">
          <p className="text-sm font-semibold">Screenshot Warning</p>
          <p className="mt-2 text-sm leading-6">
            Some Phase 2 governance scenarios are not directly reproducible from the basic calculator form because
            the current form does not expose all evidence/governance fields. This review page reflects the actual
            validated Phase 2 stress-test outputs.
          </p>
        </div>

        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500">Scenarios</div>
            <div className="mt-1 text-xl font-semibold text-gray-900">{phase2StressTestResults.totalScenarios}</div>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-800 shadow-sm">
            <div className="text-xs uppercase tracking-wide opacity-80">Passed</div>
            <div className="mt-1 text-xl font-semibold">{phase2StressTestResults.passed}</div>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-sm">
            <div className="text-xs uppercase tracking-wide opacity-80">Failed</div>
            <div className="mt-1 text-xl font-semibold">{phase2StressTestResults.failed}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500">Consistency</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">Deterministic</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500">Governance Override</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">Validated</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500">Generated At</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">{phase2StressTestResults.generatedAt}</div>
          </div>
        </div>

        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {scenarioResults.map((result, index) => {
              const scenarioNumber = String(index + 1).padStart(2, "0")

              return (
                <a
                  key={result.scenarioId}
                  href={`#scenario-${scenarioNumber}`}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                  {scenarioNumber} {result.name}
                </a>
              )
            })}
          </div>
        </div>

        <div className="space-y-6">
          {scenarioResults.map((result, index) => (
            <ScenarioCard
              key={result.scenarioId}
              result={result}
              scenarioNumber={String(index + 1).padStart(2, "0")}
            />
          ))}
        </div>
      </div>
    </main>
  )
}
