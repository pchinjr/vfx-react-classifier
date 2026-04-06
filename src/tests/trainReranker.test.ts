import { assert, assertEquals, assertGreater } from '@std/assert'

import type { CandidateFeatureValues } from '../domain/candidateFeatureVector.ts'
import { CANDIDATE_FEATURE_SCHEMA_VERSION } from '../domain/candidateFeatureVector.ts'
import type { CandidateTrainingRow } from '../domain/candidateTrainingRow.ts'
import { CANDIDATE_FEATURE_ORDER } from '../services/ml/buildCandidateFeatures.ts'
import {
  parseFeatureVector,
  scoreWithLogisticReranker,
  trainLogisticReranker,
} from '../services/ml/trainReranker.ts'

function featureJson(overrides: Partial<CandidateFeatureValues>) {
  const values: CandidateFeatureValues = {
    heuristicRank: 1,
    heuristicConfidence: 0.5,
    queryTitleSimilarity: 1,
    queryOverviewOverlap: 0.1,
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
  candidateMovieId: string,
  label: 0 | 1,
  featureOverrides: Partial<CandidateFeatureValues>,
): CandidateTrainingRow {
  return {
    spanId: 'span_one',
    episodeId: 'ep_one',
    candidateMovieId,
    label,
    resolverVersion: 'span-movie-resolver-v1',
    spanText: 'Mortal Kombat is the main topic.',
    movieTitle: candidateMovieId,
    featureJson: featureJson(featureOverrides),
    split: 'train',
  }
}

Deno.test('trainLogisticReranker trains a deterministic baseline model', () => {
  const rows = [
    row('movie_positive', 1, {
      heuristicRank: 2,
      heuristicConfidence: 0.7,
      exactTitleInSpan: 1,
      titleMentionCount: 3,
      popularity: 10,
      logVoteCount: 8,
    }),
    row('movie_negative', 0, {
      heuristicRank: 1,
      heuristicConfidence: 0.9,
      exactTitleInSpan: 0,
      titleMentionCount: 0,
      popularity: 1,
      logVoteCount: 2,
    }),
  ]

  const model = trainLogisticReranker(rows, {
    now: '2026-01-01T00:00:00.000Z',
    version: 'test',
    iterations: 200,
    learningRate: 0.2,
  })

  const positiveScore = scoreWithLogisticReranker(
    model,
    parseFeatureVector(rows[0]),
  )
  const negativeScore = scoreWithLogisticReranker(
    model,
    parseFeatureVector(rows[1]),
  )

  assertEquals(model.modelType, 'logistic_regression')
  assertEquals(model.featureSchemaVersion, CANDIDATE_FEATURE_SCHEMA_VERSION)
  assertEquals(model.metrics.rows, 2)
  assertEquals(model.metrics.spans, 1)
  assertGreater(positiveScore, negativeScore)
  assertEquals(model.metrics.top1Accuracy, 1)
  assertEquals(model.metrics.baselineTop1Accuracy, 0)
})

Deno.test('trainLogisticReranker rejects empty training rows', () => {
  try {
    trainLogisticReranker([])
    assert(false)
  } catch (error) {
    assert(error instanceof Error)
    assertEquals(error.message, 'Cannot train reranker without training rows')
  }
})
