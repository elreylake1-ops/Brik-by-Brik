import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = process.cwd()

const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  ".vercel",
  "coverage",
  "dist",
  "build",
  ".turbo",
  ".cache",
])

const EXCLUDED_FILES = new Set([
  path.normalize("db/audits/phase4_legacy_branding_audit.sql"),
  path.normalize("db/audits/phase4_legacy_branding_cleanup_PROPOSED.sql"),
  path.normalize("docs/phase4/PHASE_4_COMPLETION_REPOSITORY_BRANDING_CLEANUP.md"),
  path.normalize("docs/phase4/PHASE_4_COMPLETION_JAMES_PRODUCTION_CONNECTION_REVERIFICATION.md"),
  path.normalize("docs/phase4/PHASE_4_COMPLETION_NEW_JAMES_VERCEL_PROJECT_VERIFICATION.md"),
  path.normalize("__tests__/legacy-branding-guard.test.ts"),
  path.normalize("__tests__/phase4a-migration-consistency.test.ts"),
])

const EXCLUDED_BASENAME_PREFIXES = ["α"]

const FORBIDDEN_TERMS = [
  ["Lake", " Views", " Property"].join(""),
  ["Lake", " View", " Property"].join(""),
  ["Lake", "Views", "Property"].join(""),
  ["lake", "views", "property"].join(""),
  ["lake", "-", "views", "-", "property"].join(""),
  ["lake", "_", "views", "_", "property"].join(""),
  ["Lake", " Views"].join(""),
  ["Lake", "Views"].join(""),
  ["lake", " views"].join(""),
  ["lake", "views"].join(""),
  ["lakeviewsproperty", ".", "vercel", ".", "app"].join(""),
]

const ALLOWED_EXTENSIONS = new Set([".md", ".mdx", ".ts", ".tsx", ".js", ".mjs", ".json", ".sql", ".yaml", ".yml", ".txt"])

function walk(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) {
      continue
    }

    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walk(fullPath))
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    if (!ALLOWED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      continue
    }

    const relativePath = path.relative(ROOT, fullPath)
    const normalizedRelativePath = path.normalize(relativePath)
    if (EXCLUDED_BASENAME_PREFIXES.some((prefix) => path.basename(fullPath).startsWith(prefix))) {
      continue
    }
    if (EXCLUDED_FILES.has(normalizedRelativePath)) {
      continue
    }

    files.push(fullPath)
  }

  return files
}

function hasForbiddenBranding(content: string) {
  const lowered = content.toLowerCase()
  return FORBIDDEN_TERMS.some((term) => lowered.includes(term.toLowerCase()))
}

describe("legacy branding guard", () => {
  it("detects forbidden legacy branding while allowing canonical branding", () => {
    expect(hasForbiddenBranding("Brik by Brik Engine")).toBe(false)
    expect(hasForbiddenBranding("Lake Views Property")).toBe(true)
    expect(hasForbiddenBranding("lakeviewsproperty.vercel.app")).toBe(true)
  })

  it("keeps active source and docs covered while skipping only explicit audit artifacts", () => {
    const files = walk(ROOT)

    expect(files).toContain(path.join(ROOT, "app", "page.tsx"))
    expect(files).toContain(path.join(ROOT, "components", "ResultsDisplay.tsx"))
    expect(files).toContain(path.join(ROOT, "db", "migrations", "20260522_phase4a_saved_deals_table.sql"))
    expect(files).toContain(path.join(ROOT, "docs", "PHASE_1A_QA_REPORT.md"))
    expect(files).toContain(path.join(ROOT, "README.md"))

    expect(files).not.toContain(path.join(ROOT, "db", "audits", "phase4_legacy_branding_audit.sql"))
    expect(files).not.toContain(path.join(ROOT, "db", "audits", "phase4_legacy_branding_cleanup_PROPOSED.sql"))
    expect(files).not.toContain(path.join(ROOT, "docs", "phase4", "PHASE_4_COMPLETION_REPOSITORY_BRANDING_CLEANUP.md"))
    expect(files).not.toContain(path.join(ROOT, "docs", "phase4", "PHASE_4_COMPLETION_JAMES_PRODUCTION_CONNECTION_REVERIFICATION.md"))
    expect(files).not.toContain(path.join(ROOT, "docs", "phase4", "PHASE_4_COMPLETION_NEW_JAMES_VERCEL_PROJECT_VERIFICATION.md"))
  })

  it("does not allow legacy Lake Views branding in active repository content", () => {
    const files = walk(ROOT)
    const failures: Array<{ file: string; term: string }> = []

    for (const file of files) {
      const content = readFileSync(file, "utf8")

      for (const term of FORBIDDEN_TERMS) {
        if (content.toLowerCase().includes(term.toLowerCase())) {
          failures.push({ file: path.relative(ROOT, file), term })
        }
      }
    }

    expect(failures).toEqual([])
  }, 15_000)
})
