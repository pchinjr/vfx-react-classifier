import { buildCandidateFeatureVectorsForSpan } from '../services/ml/buildCandidateFeatures.ts'
import { initializeDatabase, openDatabase } from '../services/storage/db.ts'
import { handleCliError, parseStringFlag } from './shared.ts'

const args = [...Deno.args]
const spanId = parseStringFlag(args, '--span')
const db = openDatabase()

try {
  initializeDatabase(db)

  if (!spanId) {
    throw new Error('Usage: deno task ml:features --span <span-id>')
  }

  const rows = buildCandidateFeatureVectorsForSpan(db, spanId)
  if (!rows.length) {
    console.log('No candidate features found.')
  }

  for (const row of rows) {
    console.log(`#${row.rank} | ${row.movieTitle} | ${row.movieId}`)
    console.log(JSON.stringify(row.features))
    console.log('')
  }
} catch (error) {
  handleCliError(error)
} finally {
  db.close()
}
