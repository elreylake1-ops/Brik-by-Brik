import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = process.cwd()

const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
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
  path.normalize("__tests__/legacy-branding-guard.test.ts"),
  path.normalize("__tests__/phase4a-migration-consistency.test.ts"),
])

const EXCLUDED_PATH_FRAGMENTS = [
  path.normalize("docs/phase4"),
  path.normalize("docs/client-return"),
]

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
    if (EXCLUDED_PATH_FRAGMENTS.some((fragment) => normalizedRelativePath.includes(fragment))) {
      continue
    }
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

describe("legacy branding guard", () => {
  it("does not allow legacy Lake Views branding in active repository content", () => {
    const files = walk(ROOT)
    const failures: Array<{ file: string; term: string }> = []

    for (const file of files) {
      const content = readFileSync(file, "utf8").toLowerCase()

      for (const term of FORBIDDEN_TERMS) {
        if (content.includes(term.toLowerCase())) {
          failures.push({ file: path.relative(ROOT, file), term })
        }
      }
    }

    expect(failures).toEqual([])
  })
})
