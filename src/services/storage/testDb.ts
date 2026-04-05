import { join } from '@std/path'

import { initializeDatabase, openDatabase } from './db.ts'

// Tests get isolated throwaway SQLite files so repository tests stay realistic
// without mutating the main development database.
export function createTestDatabase(name: string) {
  const path = join(
    Deno.makeTempDirSync({ prefix: 'vfx-react-db-' }),
    `${name}.sqlite`,
  )
  const db = openDatabase(path)
  initializeDatabase(db)
  return { db, path }
}
