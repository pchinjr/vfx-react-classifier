import { getEnv } from '../config/env.ts'
import { batchEmbedSegments } from '../services/embeddings/batchEmbedSegments.ts'
import { initializeDatabase, openDatabase } from '../services/storage/db.ts'
import {
  getAllSegments,
  getSegmentsMissingEmbeddings,
} from '../services/storage/segmentsRepo.ts'
import { handleCliError, parseBooleanFlag } from './shared.ts'

// Re-embedding is separated from ingest so partial ingests can be resumed after
// temporary quota or network failures.
const force = parseBooleanFlag(Deno.args, '--force')
const db = openDatabase()

try {
  initializeDatabase(db)
  const model = getEnv().openAiEmbeddingModel
  const segments = force
    ? getAllSegments(db)
    : getSegmentsMissingEmbeddings(db, model)
  const embeddings = await batchEmbedSegments(segments, { db, model })

  console.log(`Embedded ${embeddings.length} segments using ${model}`)
} catch (error) {
  handleCliError(error)
} finally {
  db.close()
}
