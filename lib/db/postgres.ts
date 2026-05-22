import { Pool } from "pg"
import type { QueryResultRow } from "pg"

let pool: Pool | null = null

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Postgres adapter usage.")
  }

  return databaseUrl
}

export function getPostgresPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: getDatabaseUrl() })
  }

  return pool
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]) {
  return getPostgresPool().query<T>(text, values)
}

export function __resetPostgresPoolForTests() {
  pool = null
}
