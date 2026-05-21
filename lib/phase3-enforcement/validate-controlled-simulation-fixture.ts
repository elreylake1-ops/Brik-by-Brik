import {
  SIMULATION_RUNTIME_MODES,
  SIMULATION_SCENARIO_IDS,
  type ControlledSimulationFixture,
  type SimulationScenarioId,
} from "@/types/phase3-enforcement"

export type ControlledSimulationFixtureValidationResult = {
  valid: boolean
  errors: string[]
  warnings: string[]
  fixtureCount: number
  scenarioIds: SimulationScenarioId[]
}

const FORBIDDEN_KEYS = [
  "liveApi",
  "apiUrl",
  "database",
  "dbUrl",
  "persistence",
  "aiProvider",
  "scraping",
  "crm",
  "mutation",
  "integration",
  "externalService",
  "webhook",
  "runtimeWrite",
  "telemetryStorage",
] as const

const REQUIRED_EXPECTED_OUTPUT_KEYS = [
  "simulationId",
  "runtimeMode",
  "governanceVersion",
  "scenarioName",
  "enforcementOutcome",
  "conflictDetected",
  "driftDetected",
  "loopBreakerTriggered",
  "telemetrySummary",
  "safeFailAction",
  "advisoryOnly",
  "expectedResult",
] as const

const ALLOWED_RUNTIME_MODES = new Set<string>(SIMULATION_RUNTIME_MODES)
const ALLOWED_SCENARIOS = new Set<string>(SIMULATION_SCENARIO_IDS)
const FORBIDDEN_KEY_SET = new Set<string>(FORBIDDEN_KEYS)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function collectForbiddenKeyPaths(value: unknown, path: string, out: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectForbiddenKeyPaths(item, `${path}[${index}]`, out)
    })
    return
  }

  if (!isRecord(value)) {
    return
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nextPath = path ? `${path}.${key}` : key
    if (FORBIDDEN_KEY_SET.has(key)) {
      out.push(nextPath)
    }
    collectForbiddenKeyPaths(nestedValue, nextPath, out)
  }
}

function validateFixture(
  fixture: ControlledSimulationFixture,
  index: number,
  errors: string[],
  scenarioIds: SimulationScenarioId[]
): void {
  const prefix = `fixtures[${index}]`

  if (!fixture.id?.trim()) {
    errors.push(`${prefix}: missing id`)
  }

  if (!fixture.name?.trim()) {
    errors.push(`${prefix}: missing name`)
  }

  if (!fixture.description?.trim()) {
    errors.push(`${prefix}: missing description`)
  }

  if (!fixture.input) {
    errors.push(`${prefix}: missing input`)
  }

  if (!fixture.expectedOutput) {
    errors.push(`${prefix}: missing expectedOutput`)
  }

  if (!Array.isArray(fixture.lockedBoundaryNotes) || fixture.lockedBoundaryNotes.length === 0) {
    errors.push(`${prefix}: lockedBoundaryNotes must be non-empty`)
  }

  if (fixture.input?.simulationId !== fixture.expectedOutput?.simulationId) {
    errors.push(`${prefix}: simulationId mismatch between input and expectedOutput`)
  }

  if (!ALLOWED_RUNTIME_MODES.has(fixture.input?.runtimeMode ?? "")) {
    errors.push(`${prefix}: invalid input.runtimeMode`)
  }

  if (!ALLOWED_RUNTIME_MODES.has(fixture.expectedOutput?.runtimeMode ?? "")) {
    errors.push(`${prefix}: invalid expectedOutput.runtimeMode`)
  }

  if (!fixture.input?.governanceVersion?.trim()) {
    errors.push(`${prefix}: missing input.governanceVersion`)
  }

  if (!fixture.expectedOutput?.governanceVersion?.trim()) {
    errors.push(`${prefix}: missing expectedOutput.governanceVersion`)
  }

  if (!ALLOWED_SCENARIOS.has(fixture.input?.scenarioId ?? "")) {
    errors.push(`${prefix}: invalid input.scenarioId`)
  } else {
    scenarioIds.push(fixture.input.scenarioId)
  }

  if (!fixture.expectedOutput?.expectedResult) {
    errors.push(`${prefix}: missing expectedOutput.expectedResult`)
  }

  const output = fixture.expectedOutput as Record<string, unknown>
  for (const key of REQUIRED_EXPECTED_OUTPUT_KEYS) {
    if (!(key in output)) {
      errors.push(`${prefix}: expectedOutput missing ${key}`)
    }
  }

  const forbiddenPaths: string[] = []
  collectForbiddenKeyPaths(fixture, "", forbiddenPaths)
  for (const forbiddenPath of forbiddenPaths) {
    errors.push(`${prefix}: forbidden key detected at ${forbiddenPath}`)
  }
}

export function validateControlledSimulationFixture(
  fixtureOrFixtures: ControlledSimulationFixture | readonly ControlledSimulationFixture[]
): ControlledSimulationFixtureValidationResult {
  const fixtures = Array.isArray(fixtureOrFixtures) ? fixtureOrFixtures : [fixtureOrFixtures]

  const errors: string[] = []
  const warnings: string[] = []
  const scenarioIds: SimulationScenarioId[] = []

  const idMap = new Map<string, number>()

  fixtures.forEach((fixture, index) => {
    validateFixture(fixture, index, errors, scenarioIds)

    const seenAt = idMap.get(fixture.id)
    if (seenAt !== undefined) {
      errors.push(`fixtures[${index}]: duplicate id ${fixture.id} (already used at fixtures[${seenAt}])`)
    } else {
      idMap.set(fixture.id, index)
    }
  })

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    fixtureCount: fixtures.length,
    scenarioIds,
  }
}