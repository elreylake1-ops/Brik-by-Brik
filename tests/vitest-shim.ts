function readGlobal<T>(key: string): T {
  const value = (globalThis as Record<string, unknown>)[key]

  if (value === undefined) {
    throw new Error(`Vitest global '${key}' is unavailable in the current test context.`)
  }

  return value as T
}

export const afterAll = readGlobal<typeof import("vitest").afterAll>("afterAll")
export const afterEach = readGlobal<typeof import("vitest").afterEach>("afterEach")
export const beforeAll = readGlobal<typeof import("vitest").beforeAll>("beforeAll")
export const beforeEach = readGlobal<typeof import("vitest").beforeEach>("beforeEach")
export const describe = readGlobal<typeof import("vitest").describe>("describe")
export const expect = readGlobal<typeof import("vitest").expect>("expect")
export const it = readGlobal<typeof import("vitest").it>("it")
export const test = readGlobal<typeof import("vitest").test>("test")
export const vi = readGlobal<typeof import("vitest").vi>("vi")
