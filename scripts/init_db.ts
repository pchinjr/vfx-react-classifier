import { logger } from '../src/lib/logger.ts'
import {
  initializeDatabase,
  openDatabase,
  resolveDatabasePath,
} from '../src/services/storage/db.ts'

// Small script entrypoint used by the Deno task to create the SQLite schema.
const dbPath = resolveDatabasePath()
const db = openDatabase(dbPath)

try {
  initializeDatabase(db)
  logger.info('database.initialized', { databaseUrl: dbPath })
} finally {
  db.close()
}
