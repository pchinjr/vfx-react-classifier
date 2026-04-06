import type { CandidateTrainingRow } from '../../domain/candidateTrainingRow.ts'
import type {
  LogisticRerankerModel,
  RerankerMetrics,
} from '../../domain/mlModel.ts'
import {
  parseFeatureVector,
  scoreWithLogisticReranker,
} from './trainReranker.ts'

type ScoredRow = {
  row: CandidateTrainingRow
  score: number
  baselineScore: number
}

export type EvaluationSplit = CandidateTrainingRow['split'] | 'all'

function groupBySpanAndResolver(rows: ScoredRow[]) {
  const groups = new Map<string, ScoredRow[]>()
  for (const row of rows) {
    const key = `${row.row.spanId}::${row.row.resolverVersion}`
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return groups
}

export function metricsForScoredRows(scoredRows: ScoredRow[]): RerankerMetrics {
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
  const bySpan = groupBySpanAndResolver(scoredRows)

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

export function filterRowsForEvaluation(
  rows: CandidateTrainingRow[],
  options: {
    split?: EvaluationSplit
    resolverVersion?: string
  } = {},
) {
  return rows.filter((row) =>
    (!options.split || options.split === 'all' ||
      row.split === options.split) &&
    (!options.resolverVersion ||
      row.resolverVersion === options.resolverVersion)
  )
}

export function evaluateRerankerRows(
  rows: CandidateTrainingRow[],
  model?: LogisticRerankerModel,
): RerankerMetrics {
  return metricsForScoredRows(
    rows.map((row) => {
      const vector = parseFeatureVector(row)
      return {
        row,
        score: model
          ? scoreWithLogisticReranker(model, vector)
          : vector.values.heuristicConfidence,
        baselineScore: -vector.values.heuristicRank,
      }
    }),
  )
}
