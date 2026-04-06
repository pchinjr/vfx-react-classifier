import { loadLogisticReranker } from '../services/ml/loadReranker.ts'
import { buildCandidateFeatureVectorsForSpan } from '../services/ml/buildCandidateFeatures.ts'
import { scoreWithLogisticReranker } from '../services/ml/trainReranker.ts'
import { initializeDatabase, openDatabase } from '../services/storage/db.ts'
import { handleCliError, parseStringFlag } from './shared.ts'

const args = [...Deno.args]
const spanId = parseStringFlag(args, '--span')
const modelPath = parseStringFlag(args, '--model') ??
  'artifacts/ml/reranker-baseline.json'
const db = openDatabase()

try {
  initializeDatabase(db)

  if (!spanId) {
    throw new Error(
      'Usage: deno task ml:score-span --span <span-id> [--model <path>]',
    )
  }

  const model = await loadLogisticReranker(modelPath)
  const features = buildCandidateFeatureVectorsForSpan(db, spanId)
  const scored = features.map((item) => ({
    ...item,
    score: scoreWithLogisticReranker(model, item.features),
  })).sort((left, right) => right.score - left.score)

  console.log(`Span: ${spanId}`)
  console.log(`Model: ${model.name}@${model.version}`)
  console.log(`Candidates: ${scored.length}`)
  console.log('')

  for (const [index, item] of scored.entries()) {
    console.log(
      `#${index + 1} | ${item.movieTitle} | score=${item.score.toFixed(4)}`,
    )
  }
} catch (error) {
  handleCliError(error)
} finally {
  db.close()
}
