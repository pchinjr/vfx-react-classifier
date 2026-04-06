import { assertEquals } from '@std/assert'

import type { CandidateFeatureValues } from '../domain/candidateFeatureVector.ts'
import { CANDIDATE_FEATURE_SCHEMA_VERSION } from '../domain/candidateFeatureVector.ts'
import type { CandidateTrainingRow } from '../domain/candidateTrainingRow.ts'
import { CANDIDATE_FEATURE_ORDER } from '../services/ml/buildCandidateFeatures.ts'
import {
  evaluateRerankerRows,
  filterRowsForEvaluation,
} from '../services/ml/evaluateReranker.ts'

function featureJson(overrides: Partial<CandidateFeatureValues>) {
  const values: CandidateFeatureValues = {
    heuristicRank: 1,
    heuristicConfidence: 0.5,
    queryTitleSimilarity: 1,
    queryOverviewOverlap: 0,
    exactTitleInSpan: 0,
    titleMentionCount: 0,
    titleTokenOverlap: 0,
    overviewTokenOverlap: 0,
    releaseYearMentioned: 0,
    comparativeContext: 0,
    popularity: 0,
    logVoteCount: 0,
    candidateCount: 2,
    sameNormalizedTitleCount: 1,
    ...overrides,
  }

  return JSON.stringify({
    schemaVersion: CANDIDATE_FEATURE_SCHEMA_VERSION,
    featureOrder: CANDIDATE_FEATURE_ORDER,
    values,
  })
}

function row(
  overrides: Partial<CandidateTrainingRow> & {
    candidateMovieId: string
    label: 0 | 1
    heuristicRank: number
  },
): CandidateTrainingRow {
  return {
    spanId: 'span_one',
    episodeId: 'ep_one',
    resolverVersion: 'span-movie-resolver-v1',
    spanText: 'Mortal Kombat discussion',
    movieTitle: overrides.candidateMovieId,
    featureJson: featureJson({ heuristicRank: overrides.heuristicRank }),
    split: 'train',
    ...overrides,
  }
}

Deno.test('evaluateRerankerRows compares score order against heuristic baseline', () => {
  const rows = [
    row({
      candidateMovieId: 'movie_wrong',
      label: 0,
      heuristicRank: 1,
    }),
    row({
      candidateMovieId: 'movie_correct',
      label: 1,
      heuristicRank: 2,
    }),
  ]

  const metrics = evaluateRerankerRows(rows)

  assertEquals(metrics.rows, 2)
  assertEquals(metrics.spans, 1)
  assertEquals(metrics.baselineTop1Accuracy, 0)
  assertEquals(metrics.baselineMrr, 0.5)
})

Deno.test('filterRowsForEvaluation filters by split and resolver version', () => {
  const rows = [
    row({
      candidateMovieId: 'movie_train',
      label: 1,
      heuristicRank: 1,
      split: 'train',
      resolverVersion: 'span-movie-resolver-v1',
    }),
    row({
      candidateMovieId: 'movie_validation',
      label: 0,
      heuristicRank: 2,
      split: 'validation',
      resolverVersion: 'span-movie-resolver-v1+candidate-reranker@test',
    }),
  ]

  assertEquals(
    filterRowsForEvaluation(rows, {
      split: 'validation',
      resolverVersion: 'span-movie-resolver-v1+candidate-reranker@test',
    }).map((item) => item.candidateMovieId),
    ['movie_validation'],
  )
})
