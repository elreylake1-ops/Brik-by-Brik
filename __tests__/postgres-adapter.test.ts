import { afterEach, describe, expect, it } from "vitest"
import { __resetPostgresPoolForTests, getPostgresPool, query } from "@/lib/db/postgres"

describe("phase 4a postgres adapter", () => {
  afterEach(() => {
    delete process.env.DATABASE_URL
    __resetPostgresPoolForTests()
  })

  it("exports adapter accessors", () => {
    expect(typeof getPostgresPool).toBe("function")
    expect(typeof query).toBe("function")
  })

  it("throws clear error when DATABASE_URL is missing", () => {
    expect(() => getPostgresPool()).toThrow("DATABASE_URL is required for Postgres adapter usage.")
  })
})
