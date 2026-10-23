import * as path from "node:path"

// Security guards for isolated QA endpoints, workers, and local storage services.
// Strictly fails closed in Production, Preview, or CI environments.
export function isQaEnvironment(env: Record<string, string | undefined> = process.env): boolean {
  if (
    env.NODE_ENV === "production" ||
    Boolean(env.VERCEL) ||
    Boolean(env.VERCEL_ENV) ||
    Boolean(env.NEXT_PUBLIC_VERCEL_ENV) ||
    Boolean(env.CI) ||
    env.APP_ENV === "production"
  ) {
    return false
  }
  return env.NODE_ENV === "development" || env.NODE_ENV === "test"
}

export function assertSafeQaPath(baseDir: string, ...segments: string[]): string {
  const resolvedBase = path.resolve(baseDir)
  const target = path.resolve(resolvedBase, ...segments)
  if (!target.startsWith(resolvedBase + path.sep) && target !== resolvedBase) {
    throw new Error("Security violation: path traversal detected outside QA root.")
  }
  return target
}

export function isValidIdentifier(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(id)
}
