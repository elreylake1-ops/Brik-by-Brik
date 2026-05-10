import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import type { Phase2ScenarioFixture } from "@/types/phase2-validation"

export const PHASE2_EXPECTED_SCENARIO_COUNT = 15

function getPhase2FixturesDir(): string {
  return path.resolve(process.cwd(), "tests", "fixtures", "phase2")
}

export function loadPhase2Fixtures(): Phase2ScenarioFixture[] {
  const fixturesDir = getPhase2FixturesDir()
  const fixtureFiles = readdirSync(fixturesDir)
    .filter((fileName) => /^\d{2}-.*\.json$/.test(fileName))
    .sort()

  return fixtureFiles.map((fileName) => {
    const filePath = path.join(fixturesDir, fileName)
    return JSON.parse(readFileSync(filePath, "utf8")) as Phase2ScenarioFixture
  })
}
