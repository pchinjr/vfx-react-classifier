import type {
  CandidateFeatureVector,
} from '../../domain/candidateFeatureVector.ts'
import type { CandidateTrainingRow } from '../../domain/candidateTrainingRow.ts'
import type {
  LogisticRerankerModel,
  RerankerMetrics,
} from '../../domain/mlModel.ts'
import { makeId } from '../../lib/ids.ts'
import { nowIso } from '../../lib/time.ts'

export type TrainRerankerOptions = {
  name?: string
  version?: string
  iterations?: number
  learningRate?: number
  l2?: number
  now?: string
}

type ScoredRow = {
  row: CandidateTrainingRow
  score: number
  baselineScore: number
}

function sigmoid(value: number) {
  if (value >= 0) {
    const z = Math.exp(-value)
    return 1 / (1 + z)
  }

  const z = Math.exp(value)
  return z / (1 + z)
}

function dot(left: number[], right: number[]) {
  return left.reduce(
    (sum, value, index) => sum + value * (right[index] ?? 0),
    0,
  )
}

export function parseFeatureVector(row: CandidateTrainingRow) {
  return JSON.parse(row.featureJson) as CandidateFeatureVector
}

export function featureVectorToArray(
  vector: CandidateFeatureVector,
): number[] {
  return vector.featureOrder.map((feature) => vector.values[feature])
}

function normalizeMatrix(matrix: number[][]) {
  const width = matrix[0]?.length ?? 0
  const means = Array(width).fill(0)
  const scales = Array(width).fill(1)

  for (let column = 0; column < width; column += 1) {
    means[column] = matrix.reduce((sum, row) => sum + row[column], 0) /
      matrix.length
    const variance = matrix.reduce((sum, row) => {
      const delta = row[column] - means[column]
      return sum + delta * delta
    }, 0) / matrix.length
    scales[column] = Math.sqrt(variance) || 1
  }

  return {
    means,
    scales,
    normalized: matrix.map((row) =>
      row.map((value, index) => (value - means[index]) / scales[index])
    ),
  }
}

function scoreRows(
  rows: CandidateTrainingRow[],
  scores: number[],
): ScoredRow[] {
  return rows.map((row, index) => {
    const values = parseFeatureVector(row).values
    return {
      row,
      score: scores[index],
      baselineScore: -values.heuristicRank,
    }
  })
}

function metricsFor(scoredRows: ScoredRow[]): RerankerMetrics {
  if (!scoredRows.length) {
    return {
      rows: 0,
      spans: 0,
      accuracy: 0,
      top1Accuracy: 0,
      top3Recall: 0,
      mrr: 0,
      baselineTop1Accuracy: 0,
      baselineTop3Recall: 0,
      baselineMrr: 0,
    }
  }

  const correct =
    scoredRows.filter((item) => (item.score >= 0.5 ? 1 : 0) === item.row.label)
      .length
  const bySpan = Map.groupBy(scoredRows, (item) => item.row.spanId)

  let top1 = 0
  let top3 = 0
  let mrr = 0
  let baselineTop1 = 0
  let baselineTop3 = 0
  let baselineMrr = 0

  for (const candidates of bySpan.values()) {
    const ranked = [...candidates].sort((left, right) =>
      right.score - left.score
    )
    const baselineRanked = [...candidates].sort((left, right) =>
      right.baselineScore - left.baselineScore
    )
    const positiveIndex = ranked.findIndex((item) => item.row.label === 1)
    const baselinePositiveIndex = baselineRanked.findIndex((item) =>
      item.row.label === 1
    )

    if (positiveIndex === 0) {
      top1 += 1
    }
    if (positiveIndex >= 0 && positiveIndex < 3) {
      top3 += 1
    }
    if (positiveIndex >= 0) {
      mrr += 1 / (positiveIndex + 1)
    }

    if (baselinePositiveIndex === 0) {
      baselineTop1 += 1
    }
    if (baselinePositiveIndex >= 0 && baselinePositiveIndex < 3) {
      baselineTop3 += 1
    }
    if (baselinePositiveIndex >= 0) {
      baselineMrr += 1 / (baselinePositiveIndex + 1)
    }
  }

  const spanCount = bySpan.size
  return {
    rows: scoredRows.length,
    spans: spanCount,
    accuracy: correct / scoredRows.length,
    top1Accuracy: top1 / spanCount,
    top3Recall: top3 / spanCount,
    mrr: mrr / spanCount,
    baselineTop1Accuracy: baselineTop1 / spanCount,
    baselineTop3Recall: baselineTop3 / spanCount,
    baselineMrr: baselineMrr / spanCount,
  }
}

export function trainLogisticReranker(
  rows: CandidateTrainingRow[],
  options: TrainRerankerOptions = {},
): LogisticRerankerModel {
  if (!rows.length) {
    throw new Error('Cannot train reranker without training rows')
  }

  const vectors = rows.map((row) => parseFeatureVector(row))
  const featureOrder = vectors[0].featureOrder
  const featureSchemaVersion = vectors[0].schemaVersion
  for (const vector of vectors) {
    if (vector.schemaVersion !== featureSchemaVersion) {
      throw new Error('Mixed feature schema versions are not supported')
    }
    if (vector.featureOrder.join('|') !== featureOrder.join('|')) {
      throw new Error('Mixed feature orders are not supported')
    }
  }

  const matrix = vectors.map(featureVectorToArray)
  const { means, scales, normalized } = normalizeMatrix(matrix)
  const labels = rows.map((row) => row.label)
  const iterations = options.iterations ?? 300
  const learningRate = options.learningRate ?? 0.1
  const l2 = options.l2 ?? 0.001
  const weights = Array(featureOrder.length).fill(0)
  let bias = 0

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const gradients = Array(weights.length).fill(0)
    let biasGradient = 0

    for (const [index, features] of normalized.entries()) {
      const prediction = sigmoid(dot(weights, features) + bias)
      const error = prediction - labels[index]
      for (const featureIndex of weights.keys()) {
        gradients[featureIndex] += error * features[featureIndex]
      }
      biasGradient += error
    }

    for (const featureIndex of weights.keys()) {
      const regularization = l2 * weights[featureIndex]
      weights[featureIndex] -= learningRate *
        (gradients[featureIndex] / rows.length + regularization)
    }
    bias -= learningRate * (biasGradient / rows.length)
  }

  const scores = normalized.map((features) =>
    sigmoid(dot(weights, features) + bias)
  )
  const metrics = metricsFor(scoreRows(rows, scores))
  const createdAt = options.now ?? nowIso()
  const name = options.name ?? 'candidate-reranker'
  const version = options.version ?? createdAt.replace(/[:.]/g, '-')

  return {
    id: makeId('mlmodel', name, version, featureSchemaVersion),
    name,
    version,
    modelType: 'logistic_regression',
    featureSchemaVersion,
    featureOrder,
    weights,
    bias,
    means,
    scales,
    metrics,
    createdAt,
  }
}

export function scoreWithLogisticReranker(
  model: LogisticRerankerModel,
  vector: CandidateFeatureVector,
) {
  if (vector.schemaVersion !== model.featureSchemaVersion) {
    throw new Error(
      `Feature schema mismatch: model=${model.featureSchemaVersion}, vector=${vector.schemaVersion}`,
    )
  }

  if (vector.featureOrder.join('|') !== model.featureOrder.join('|')) {
    throw new Error('Feature order mismatch between model and vector')
  }

  const features = model.featureOrder.map((feature, index) =>
    (vector.values[feature] - model.means[index]) / model.scales[index]
  )
  return sigmoid(dot(model.weights, features) + model.bias)
}
