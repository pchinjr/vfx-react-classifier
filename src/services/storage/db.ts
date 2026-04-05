import { dirname, resolve } from '@std/path'
import { ensureDirSync } from '@std/fs'
import { DB } from 'sqlite'

import { getEnv } from '../../config/env.ts'
import { SQL_SCHEMA } from './schema.ts'

export type DatabaseClient = DB

// SQLite is the v1 default because the workload is still small and the repo
// benefits from a zero-infra local database.
export function resolveDatabasePath(databaseUrl?: string) {
  const configured = databaseUrl ?? getEnv().databaseUrl
  return resolve(configured)
}

export function openDatabase(databaseUrl?: string) {
  const path = resolveDatabasePath(databaseUrl)
  ensureDirSync(dirname(path))
  const db = new DB(path)
  db.execute('PRAGMA foreign_keys = ON')
  return db
}

export function initializeDatabase(db: DatabaseClient) {
  db.execute(SQL_SCHEMA)
}
