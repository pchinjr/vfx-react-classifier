import { dirname } from '@std/path'

import { initializeDatabase, openDatabase } from '../services/storage/db.ts'
import {
  buildCandidateTrainingRows,
  toJsonl,
} from '../services/ml/buildTrainingDataset.ts'
import { handleCliError, parseStringFlag } from './shared.ts'

const args = [...Deno.args]
const outputPath = parseStringFlag(args, '--out') ??
  'artifacts/ml/candidate-training.jsonl'
const db = openDatabase()

try {
  initializeDatabase(db)

  const rows = buildCandidateTrainingRows(db)
  await Deno.mkdir(dirname(outputPath), { recursive: true })
  await Deno.writeTextFile(outputPath, toJsonl(rows))

  const positives = rows.filter((row) => row.label === 1).length
  const negatives = rows.length - positives
  const spans = new Set(rows.map((row) => row.spanId)).size

  console.log(`Output: ${outputPath}`)
  console.log(`Rows: ${rows.length}`)
  console.log(`Spans: ${spans}`)
  console.log(`Positive rows: ${positives}`)
  console.log(`Negative rows: ${negatives}`)
  console.log(
    `Splits: train=${
      rows.filter((row) => row.split === 'train').length
    }, validation=${
      rows.filter((row) => row.split === 'validation').length
    }, test=${rows.filter((row) => row.split === 'test').length}`,
  )
} catch (error) {
  handleCliError(error)
} finally {
  db.close()
}
