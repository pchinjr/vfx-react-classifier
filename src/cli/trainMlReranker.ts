import { dirname } from '@std/path'

import type { CandidateTrainingRow } from '../domain/candidateTrainingRow.ts'
import { trainLogisticReranker } from '../services/ml/trainReranker.ts'
import { handleCliError, parseNumberFlag, parseStringFlag } from './shared.ts'

const args = [...Deno.args]
const datasetPath = parseStringFlag(args, '--dataset') ??
  'artifacts/ml/candidate-training.jsonl'
const outputPath = parseStringFlag(args, '--out') ??
  'artifacts/ml/reranker-baseline.json'
const iterations = parseNumberFlag(args, '--iterations') ?? 300
const learningRate = parseNumberFlag(args, '--learning-rate') ?? 0.1

function readJsonlRows(path: string) {
  const text = Deno.readTextFileSync(path)
  return text.split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CandidateTrainingRow)
}

try {
  const rows = readJsonlRows(datasetPath)
  const trainingRows = rows.filter((row) => row.split === 'train')
  const model = trainLogisticReranker(
    trainingRows.length ? trainingRows : rows,
    {
      iterations,
      learningRate,
    },
  )

  await Deno.mkdir(dirname(outputPath), { recursive: true })
  await Deno.writeTextFile(outputPath, JSON.stringify(model, null, 2) + '\n')

  console.log(`Dataset: ${datasetPath}`)
  console.log(`Output: ${outputPath}`)
  console.log(`Model: ${model.name}`)
  console.log(`Version: ${model.version}`)
  console.log(`Rows: ${model.metrics.rows}`)
  console.log(`Spans: ${model.metrics.spans}`)
  console.log(`Accuracy: ${model.metrics.accuracy.toFixed(4)}`)
  console.log(`Top-1 accuracy: ${model.metrics.top1Accuracy.toFixed(4)}`)
  console.log(`Top-3 recall: ${model.metrics.top3Recall.toFixed(4)}`)
  console.log(`MRR: ${model.metrics.mrr.toFixed(4)}`)
  console.log(
    `Baseline top-1 accuracy: ${model.metrics.baselineTop1Accuracy.toFixed(4)}`,
  )
  console.log(
    `Baseline top-3 recall: ${model.metrics.baselineTop3Recall.toFixed(4)}`,
  )
  console.log(`Baseline MRR: ${model.metrics.baselineMrr.toFixed(4)}`)
} catch (error) {
  handleCliError(error)
}
