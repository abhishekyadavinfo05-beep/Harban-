import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema.ts'

declare global {
  var _postgresPool: Pool | undefined
}

const TRANSIENT_PG_CODES = new Set([
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now (scale-to-zero waking up)
  '08000', // connection_exception
  '08003', // connection_does_not_exist
  '08006', // connection_failure
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'ECONNREFUSED',
])

export function isTransientDbError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: string; message?: string; cause?: unknown }
  const code = String(e.code || '')
  const msg = String(e.message || '')
  if (TRANSIENT_PG_CODES.has(code)) return true
  if (
    /connection terminated unexpectedly|terminating connection|connection reset|socket hang up|server closed the connection|timeout expired|ECONNRESET|EPIPE|ETIMEDOUT/i.test(
      msg,
    )
  ) {
    return true
  }
  if (e.cause && e.cause !== err) {
    return isTransientDbError(e.cause)
  }
  return false
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 20000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    })

    global._postgresPool.on('error', (err) => {
      if (isTransientDbError(err)) {
        // Cloud SQL scale-to-zero / idle socket recycle — pg.Pool discards the dead client automatically
        console.warn('Idle SQL pool connection recycled:', err.message)
        return
      }
      console.error('Unexpected error on idle SQL pool client:', err)
    })
  }
  return global._postgresPool
}

const pool = createPool()

export const db = drizzle(pool, { schema })

export async function withDbRetry<T>(
  operation: () => Promise<T>,
  retries = 2,
): Promise<T> {
  let attempt = 0
  while (true) {
    try {
      return await operation()
    } catch (err) {
      if (attempt >= retries || !isTransientDbError(err)) {
        throw err
      }
      attempt += 1
      await new Promise((resolve) => setTimeout(resolve, 350 * attempt))
    }
  }
}
