import type { CandidateTrainingRow } from '../domain/candidateTrainingRow.ts'
import {
  evaluateRerankerRows,
  type EvaluationSplit,
  filterRowsForEvaluation,
} from '../services/ml/evaluateReranker.ts'
import { loadLogisticReranker } from '../services/ml/loadReranker.ts'
import { SPAN_MOVIE_RESOLVER_VERSION } from '../services/movies/resolveSpanMovies.ts'
import { handleCliError, parseStringFlag } from './shared.ts'

function readJsonl(path: string) {
  const text = Deno.readTextFileSync(path)
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as CandidateTrainingRow)
}

function parseSplit(value: string | null): EvaluationSplit {
  if (!value) {
    return 'all'
  }
  if (
    value === 'all' ||
    value === 'train' ||
    value === 'validation' ||
    value === 'test'
  ) {
    return value
  }
  throw new Error(`Invalid split: ${value}`)
}

function printMetric(name: string, value: number) {
  console.log(`${name}: ${value.toFixed(4)}`)
}

const args = [...Deno.args]
const datasetPath = parseStringFlag(args, '--dataset') ??
  'artifacts/ml/candidate-training.jsonl'
const modelPath = parseStringFlag(args, '--model')
const split = parseSplit(parseStringFlag(args, '--split'))
const resolverVersion = parseStringFlag(args, '--resolver-version') ??
  SPAN_MOVIE_RESOLVER_VERSION

try {
  const rows = filterRowsForEvaluation(readJsonl(datasetPath), {
    split,
    resolverVersion,
  })
  const model = modelPath ? await loadLogisticReranker(modelPath) : undefined
  const metrics = evaluateRerankerRows(rows, model)

  console.log(`Dataset: ${datasetPath}`)
  console.log(`Resolver: ${resolverVersion}`)
  console.log(`Split: ${split}`)
  console.log(`Model: ${model ? `${model.name}@${model.version}` : 'none'}`)
  console.log(`Rows: ${metrics.rows}`)
  console.log(`Spans: ${metrics.spans}`)
  printMetric('Accuracy', metrics.accuracy)
  printMetric('Top-1 accuracy', metrics.top1Accuracy)
  printMetric('Top-3 recall', metrics.top3Recall)
  printMetric('MRR', metrics.mrr)
  printMetric('Baseline top-1 accuracy', metrics.baselineTop1Accuracy)
  printMetric('Baseline top-3 recall', metrics.baselineTop3Recall)
  printMetric('Baseline MRR', metrics.baselineMrr)
} catch (error) {
  handleCliError(error)
}
