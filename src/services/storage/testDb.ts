import { join } from '@std/path'

import { initializeDatabase, openDatabase } from './db.ts'

export function createTestDatabase(name: string) {
  const path = join(
    Deno.makeTempDirSync({ prefix: 'vfx-react-db-' }),
    `${name}.sqlite`,
  )
  const db = openDatabase(path)
  initializeDatabase(db)
  return { db, path }
}
