import { drizzle } from 'drizzle-orm/d1'

export function beijingNow(): Date {
  const now = new Date()
  return new Date(now.getTime() + 8 * 60 * 60 * 1000)
}

export function beijingDate(): string {
  return beijingNow().toISOString().slice(0, 10)
}

export function beijingDatetime(): string {
  return beijingNow().toISOString().replace('T', ' ').slice(0, 19)
}

export type DrizzleDB = ReturnType<typeof drizzle>

export class D1Error extends Error {
  route: string
  label: string
  override cause: unknown
  constructor(route: string, label: string, cause: unknown) {
    super(`[D1:${route}] ${label}`)
    this.route = route
    this.label = label
    this.cause = cause
  }
}

export function createDB(d1: D1Database, route: string) {
  const db = drizzle(d1)
  async function query<T>(label: string, fn: (db: DrizzleDB) => Promise<T>): Promise<T> {
    try {
      return await fn(db)
    } catch (e) {
      console.error(`[D1:${route}] ${label} failed:`, e)
      throw new D1Error(route, label, e)
    }
  }
  return { db, query }
}
