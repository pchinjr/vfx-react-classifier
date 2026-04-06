import { assertEquals, assertGreater } from '@std/assert'

import { CANDIDATE_FEATURE_SCHEMA_VERSION } from '../domain/candidateFeatureVector.ts'
import type { DiscussionSpan } from '../domain/discussionSpan.ts'
import type { LogisticRerankerModel } from '../domain/mlModel.ts'
import type { MovieCatalogRecord } from '../domain/movieCatalog.ts'
import type { SpanMovieCandidate } from '../domain/spanResolution.ts'
import { CANDIDATE_FEATURE_ORDER } from '../services/ml/buildCandidateFeatures.ts'
import { scoreCandidateSetWithModel } from '../services/ml/scoreCandidateSet.ts'

function movie(id: string, title: string): MovieCatalogRecord {
  return {
    id,
    source: 'tmdb',
    sourceMovieId: id.replace('movie_', ''),
    mediaType: 'movie',
    title,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function candidate(
  spanId: string,
  movieId: string,
  rank: number,
): SpanMovieCandidate {
  return {
    id: `cand_${movieId}`,
    spanId,
    movieId,
    rank,
    confidence: rank === 1 ? 0.9 : 0.5,
    resolverVersion: 'span-movie-resolver-v1+candidate-reranker@test',
    evidenceJson: JSON.stringify({
      searchQuery: rank === 1 ? 'Wrong Movie' : 'Mortal Kombat',
      matchedTitle: rank === 1 ? 'Wrong Movie' : 'Mortal Kombat',
      titleSimilarity: 1,
      overviewOverlap: 0,
    }),
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function model(): LogisticRerankerModel {
  return {
    id: 'mlmodel_test',
    name: 'candidate-reranker',
    version: 'test',
    modelType: 'logistic_regression',
    featureSchemaVersion: CANDIDATE_FEATURE_SCHEMA_VERSION,
    featureOrder: CANDIDATE_FEATURE_ORDER,
    weights: CANDIDATE_FEATURE_ORDER.map((feature) =>
      feature === 'exactTitleInSpan' ? 5 : 0
    ),
    bias: 0,
    means: CANDIDATE_FEATURE_ORDER.map(() => 0),
    scales: CANDIDATE_FEATURE_ORDER.map(() => 1),
    metrics: {
      rows: 2,
      spans: 1,
      accuracy: 1,
      top1Accuracy: 1,
      top3Recall: 1,
      mrr: 1,
      baselineTop1Accuracy: 0,
      baselineTop3Recall: 1,
      baselineMrr: 0.5,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

Deno.test('scoreCandidateSetWithModel reranks candidates and preserves heuristic evidence', () => {
  const span: DiscussionSpan = {
    id: 'span_one',
    episodeId: 'ep_one',
    start: 0,
    end: 60,
    text: 'This span is clearly about Mortal Kombat and its effects.',
    sourceSegmentCount: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
  const movies = [
    movie('movie_wrong', 'Wrong Movie'),
    movie('movie_mortal_kombat', 'Mortal Kombat'),
  ]
  const reranked = scoreCandidateSetWithModel(
    span,
    [
      candidate(span.id, 'movie_wrong', 1),
      candidate(span.id, 'movie_mortal_kombat', 2),
    ],
    movies,
    model(),
  )

  assertEquals(reranked[0].movieId, 'movie_mortal_kombat')
  assertEquals(reranked[0].rank, 1)
  assertGreater(reranked[0].confidence, reranked[1].confidence)

  const evidence = JSON.parse(reranked[0].evidenceJson) as {
    heuristicRank?: number
    heuristicConfidence?: number
    model?: { name?: string; version?: string; score?: number }
  }
  assertEquals(evidence.heuristicRank, 2)
  assertEquals(evidence.heuristicConfidence, 0.5)
  assertEquals(evidence.model?.name, 'candidate-reranker')
  assertEquals(evidence.model?.version, 'test')
})
