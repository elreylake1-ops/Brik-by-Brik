import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
  }),
}))
vi.mock("next/navigation", () => ({ notFound: notFoundMock }))

import { developmentOnlyPage, isDevelopmentPageAllowed } from "@/lib/dev-only-page"

describe("fixture-only developer pages", () => {
  it("are allowed only under next dev (and unit tests), never in production or any hosted environment", () => {
    expect(isDevelopmentPageAllowed({ NODE_ENV: "development" })).toBe(true)
    expect(isDevelopmentPageAllowed({ NODE_ENV: "test" })).toBe(true)
    expect(isDevelopmentPageAllowed({ NODE_ENV: "production" })).toBe(false)
    expect(isDevelopmentPageAllowed({})).toBe(false)
    expect(isDevelopmentPageAllowed({ NODE_ENV: "development", VERCEL: "1" })).toBe(false)
    expect(isDevelopmentPageAllowed({ NODE_ENV: "development", VERCEL_ENV: "preview" })).toBe(false)
    expect(isDevelopmentPageAllowed({ NODE_ENV: "test", VERCEL_ENV: "production" })).toBe(false)
  })

  it("answer 404 in a production build, with no switch to turn them back on", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("ALLOW_DEV_PAGES", "true")
    vi.stubEnv("SHOW_FIXTURES", "true")
    expect(() => developmentOnlyPage()).toThrow("NEXT_NOT_FOUND")
    vi.unstubAllEnvs()
    expect(() => developmentOnlyPage()).not.toThrow()
  })

  it("every app/phase-* page calls the guard before rendering, so a new fixture page cannot be added unguarded", () => {
    const appDir = path.resolve(__dirname, "..", "app")
    const pages = readdirSync(appDir).filter((d) => d.startsWith("phase-")).map((d) => path.join(appDir, d, "page.tsx"))
    expect(pages.map((p) => path.basename(path.dirname(p))).sort()).toEqual([
      "phase-2-live-review",
      "phase-2-review",
      "phase-3-dev-review",
      "phase-5a-professional-gateway-proof",
    ])
    for (const p of pages) {
      const src = readFileSync(p, "utf8")
      expect(src, p).toMatch(/export default (async )?function \w+\([^)]*\) \{\s*developmentOnlyPage\(\)/)
    }
  })
})
