import { handleCliError, printSearchResults } from './shared.ts'
import { initializeDatabase, openDatabase } from '../services/storage/db.ts'
import { searchSegments } from '../services/search/searchSegments.ts'

const queryText = Deno.args.join(' ').trim()
const db = openDatabase()

try {
  if (!queryText) {
    throw new Error('Usage: deno task query <search text>')
  }

  initializeDatabase(db)
  const results = await searchSegments(queryText, { db })
  printSearchResults(results)
} catch (error) {
  handleCliError(error)
} finally {
  db.close()
}
