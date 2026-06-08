import { randomUUID } from "node:crypto"

export type SafeRouteErrorDiagnostic = {
  errorName: string
  errorCode: string | null
  errorMessage: string
  routeName: string
  traceId: string
  timestamp: string
}

function sanitizeErrorMessage(message: string): string {
  const firstLine = message.split(/\r?\n/, 1)[0] ?? ""
  const redacted = firstLine
    .replace(/DATABASE_URL\s*=\s*[^\s"'`]+/gi, "[redacted env var]")
    .replace(/[a-z]+:\/\/[^@\s"'`]+@[^ \s"'`]+/gi, "[redacted connection string]")
    .replace(/\b(password|token|secret|cookie|authorization)\b/gi, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()

  return redacted.slice(0, 180) || "Unknown error"
}

export function createSafeRouteErrorDiagnostic(routeName: string, error: unknown): SafeRouteErrorDiagnostic {
  const typedError = error as { name?: unknown; code?: unknown; message?: unknown }

  return {
    errorName: typeof typedError?.name === "string" && typedError.name.trim() ? typedError.name : "Error",
    errorCode: typeof typedError?.code === "string" && typedError.code.trim() ? typedError.code : null,
    errorMessage: sanitizeErrorMessage(typeof typedError?.message === "string" ? typedError.message : "Unknown error"),
    routeName,
    traceId: randomUUID(),
    timestamp: new Date().toISOString(),
  }
}
