import { randomUUID } from "node:crypto"

export type SafeRouteErrorDiagnostic = {
  errorName: string
  errorCode: string | null
  errorMessage: string
  routeName: string
  traceId: string
  timestamp: string
}

export type ServerRouteErrorDiagnostic = {
  diagnostic: SafeRouteErrorDiagnostic
  serverContext: string
}

export function isHostedEnvironment(env: Record<string, string | undefined> = process.env): boolean {
  if (
    env.NODE_ENV === "production" ||
    Boolean(env.VERCEL) ||
    Boolean(env.VERCEL_ENV) ||
    Boolean(env.NEXT_PUBLIC_VERCEL_ENV) ||
    env.APP_ENV === "production" ||
    env.APP_ENV === "preview"
  ) {
    return true
  }
  return false
}

export function sanitizeErrorMessage(message: string): string {
  const firstLine = message.split(/\r?\n/, 1)[0] ?? ""
  const redacted = firstLine
    // Redact env variables and secrets
    .replace(/([A-Z_]*(DATABASE|SECRET|TOKEN|KEY|PASSWORD|AUTH)[A-Z_]*)\s*=\s*[^\s"'`]+/gi, "[redacted env var]")
    // Redact connection strings
    .replace(/[a-z]+:\/\/[^@\s"'`]+@[^ \s"'`]+/gi, "[redacted connection string]")
    // Redact sensitive credential words
    .replace(/\b(password|token|secret|cookie|authorization|bearer|apikey|api_key)\b[^\s,;]*/gi, "[redacted]")
    // Redact Windows and Unix file paths
    .replace(/[a-zA-Z]:\\[^:\s"'`]+/g, "[redacted path]")
    .replace(/(?:\/[\w.-]+)+\/(?:[\w.-]+)\.(?:ts|tsx|js|jsx|json|sql)/g, "[redacted path]")
    // Redact SQL statements and clauses
    .replace(/\b(SELECT\s+[\s\S]+?\s+FROM|INSERT\s+INTO\s+[\s\S]+?|UPDATE\s+[\s\S]+?\s+SET|DELETE\s+FROM\s+[\s\S]+?|DROP\s+TABLE|ALTER\s+TABLE)\b/gi, "[redacted sql]")
    // Redact table/column/database identifiers in db errors
    .replace(/\b(relation|table|column|database|schema)\s+["'][^"']+["']/gi, "[redacted db identifier]")
    // Redact stack traces
    .replace(/\bat\s+[^\n]+/g, "[redacted stack]")
    .replace(/\s+/g, " ")
    .trim()

  return redacted.slice(0, 180) || "Unknown error"
}

export function createSafeRouteErrorDiagnostic(
  routeName: string,
  error: unknown,
  env: Record<string, string | undefined> = process.env
): SafeRouteErrorDiagnostic {
  const typedError = error as { name?: unknown; code?: unknown; message?: unknown }
  const rawMessage = typeof typedError?.message === "string" ? typedError.message : "Unknown error"
  const sanitizedMessage = sanitizeErrorMessage(rawMessage)
  const isHosted = isHostedEnvironment(env)

  const publicErrorName = isHosted
    ? "Error"
    : typeof typedError?.name === "string" && typedError.name.trim()
      ? typedError.name
      : "Error"

  const publicErrorCode = isHosted
    ? null
    : typeof typedError?.code === "string" && typedError.code.trim()
      ? typedError.code
      : null

  const publicErrorMessage = isHosted ? "An unexpected error occurred." : sanitizedMessage

  return {
    errorName: publicErrorName,
    errorCode: publicErrorCode,
    errorMessage: publicErrorMessage,
    routeName,
    traceId: randomUUID(),
    timestamp: new Date().toISOString(),
  }
}

export function createServerRouteErrorDiagnostic(
  routeName: string,
  error: unknown,
  env: Record<string, string | undefined> = process.env
): ServerRouteErrorDiagnostic {
  const typedError = error as { message?: unknown }
  const rawMessage = typeof typedError?.message === "string" ? typedError.message : "Unknown error"
  const sanitizedMessage = sanitizeErrorMessage(rawMessage)

  return {
    diagnostic: createSafeRouteErrorDiagnostic(routeName, error, env),
    serverContext: sanitizedMessage,
  }
}
