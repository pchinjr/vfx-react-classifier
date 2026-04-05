import { dirname, resolve } from '@std/path'
import { ensureDirSync } from '@std/fs'
import { DB } from 'sqlite'

import { getEnv } from '../../config/env.ts'
import { SQL_SCHEMA } from './schema.ts'

export type DatabaseClient = DB

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
