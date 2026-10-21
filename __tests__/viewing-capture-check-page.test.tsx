import { readFileSync } from "node:fs"
import path from "node:path"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import ViewingCaptureCheckPage from "@/app/viewing-capture-check/page"

afterEach(() => vi.unstubAllEnvs())

describe("capture check page", () => {
  it("renders outside a deployed environment", () => {
    vi.stubEnv("NODE_ENV", "development")
    expect(() => ViewingCaptureCheckPage()).not.toThrow()
  })

  it("is hidden (404) in a deployed environment unless explicitly enabled", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("VIEWING_CAPTURE_CHECK_PAGE", "")
    expect(() => ViewingCaptureCheckPage()).toThrow()
    vi.stubEnv("VIEWING_CAPTURE_CHECK_PAGE", "true")
    expect(() => ViewingCaptureCheckPage()).not.toThrow()
  })

  it("makes no data access: it imports no repository, API client, auth or storage code", () => {
    const src = readFileSync(path.resolve(__dirname, "../app/viewing-capture-check/page.tsx"), "utf8")
    const imports = src.match(/from\s+"[^"]+"/g) ?? []
    expect(imports.sort()).toEqual(['from "@/components/viewing-assessment/VideoCapture"', 'from "next/navigation"'])
    expect(src).not.toMatch(/fetch\(|repository|process\.env\.(DATABASE|ANTHROPIC)/)
  })

  it("enables diagnostics only for the local dry-run capture component", () => {
    vi.stubEnv("NODE_ENV", "development")
    const page = ViewingCaptureCheckPage()
    const content = page.props.children as ReactElement<{ children: ReactElement[] }>
    const capture = content.props.children.at(-1)!
    expect(capture.props).toMatchObject({ dryRun: true, diagnosticMode: true })
  })
})
