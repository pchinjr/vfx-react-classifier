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
  migrateMovieCatalogMediaType(db)
}

function tableColumns(db: DatabaseClient, tableName: string) {
  return db.queryEntries<{ name: string }>(`PRAGMA table_info(${tableName})`)
    .map((row) => row.name)
}

function migrateMovieCatalogMediaType(db: DatabaseClient) {
  const columns = new Set(tableColumns(db, 'movie_catalog'))
  if (!columns.has('media_type')) {
    db.execute(
      "ALTER TABLE movie_catalog ADD COLUMN media_type TEXT NOT NULL DEFAULT 'movie'",
    )
  }

  // TMDb movie and TV IDs can overlap, so media type must be part of the
  // catalog identity. Existing movie rows keep media_type='movie'.
  db.execute('DROP INDEX IF EXISTS idx_movie_catalog_source_movie_id')
  db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_movie_catalog_source_media_type_work_id
      ON movie_catalog (source, media_type, source_movie_id)
  `)
}
