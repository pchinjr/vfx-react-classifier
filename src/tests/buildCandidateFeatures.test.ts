import { assertEquals } from '@std/assert'

import type { DiscussionSpan } from '../domain/discussionSpan.ts'
import type { MovieCatalogRecord } from '../domain/movieCatalog.ts'
import type { SpanMovieCandidate } from '../domain/spanResolution.ts'
import {
  buildCandidateFeatureVector,
  buildCandidateFeatureVectorsForSpan,
  normalizeFeatureText,
} from '../services/ml/buildCandidateFeatures.ts'
import { upsertDiscussionSpans } from '../services/storage/discussionSpansRepo.ts'
import { upsertEpisode } from '../services/storage/episodesRepo.ts'
import { upsertMovieCatalogRecords } from '../services/storage/movieCatalogRepo.ts'
import { upsertSpanMovieCandidates } from '../services/storage/spanResolutionRepo.ts'
import { createTestDatabase } from '../services/storage/testDb.ts'

function discussionSpan(): DiscussionSpan {
  return {
    id: 'span_one',
    episodeId: 'ep_one',
    start: 0,
    end: 180,
    text:
      'They say Mortal Kombat came a year after Independence Day, but the original Mortal Kombat is the main topic.',
    sourceSegmentCount: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function movie(overrides: Partial<MovieCatalogRecord>): MovieCatalogRecord {
  return {
    id: 'movie_mortal_kombat_1995',
    source: 'tmdb',
    sourceMovieId: '9312',
    mediaType: 'movie',
    title: 'Mortal Kombat',
    originalTitle: 'Mortal Kombat',
    releaseYear: 1995,
    overview: 'A tournament movie based on the fighting video game.',
    metadataJson: JSON.stringify({ popularity: 11.5, vote_count: 2000 }),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function candidate(
  overrides: Partial<SpanMovieCandidate>,
): SpanMovieCandidate {
  return {
    id: 'cand_mortal_kombat_1995',
    spanId: 'span_one',
    movieId: 'movie_mortal_kombat_1995',
    rank: 1,
    confidence: 0.9,
    resolverVersion: 'span-movie-resolver-v1',
    evidenceJson: JSON.stringify({
      searchQuery: 'Mortal Kombat',
      titleSimilarity: 1,
      overviewOverlap: 0.25,
    }),
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function seed(db: ReturnType<typeof createTestDatabase>['db']) {
  upsertEpisode(db, {
    id: 'ep_one',
    youtubeVideoId: 'abc123',
    title: 'Episode',
    sourceUrl: 'https://youtube.com/watch?v=abc123',
    createdAt: '2026-01-01T00:00:00.000Z',
  })
  upsertDiscussionSpans(db, [discussionSpan()])
  upsertMovieCatalogRecords(db, [
    movie({}),
    movie({
      id: 'movie_mortal_kombat_2021',
      sourceMovieId: '460465',
      releaseYear: 2021,
      metadataJson: JSON.stringify({ popularity: 40, vote_count: 5000 }),
    }),
  ])
  upsertSpanMovieCandidates(db, [
    candidate({}),
    candidate({
      id: 'cand_mortal_kombat_2021',
      movieId: 'movie_mortal_kombat_2021',
      rank: 2,
      confidence: 0.85,
    }),
  ])
}

Deno.test('normalizeFeatureText lowercases and removes punctuation', () => {
  assertEquals(
    normalizeFeatureText('Air Force One: Down!'),
    'air force one down',
  )
})

Deno.test('buildCandidateFeatureVector creates stable feature values', () => {
  const vector = buildCandidateFeatureVector({
    spanId: 'span_one',
    movieId: 'movie_mortal_kombat_1995',
    spanText:
      'The original Mortal Kombat came a year after Independence Day in this comparison.',
    movieTitle: 'Mortal Kombat',
    movieOverview: 'A fighting tournament begins.',
    releaseYear: 1995,
    popularity: 11.5,
    voteCount: 2000,
    rank: 2,
    confidence: 0.85,
    evidenceJson: JSON.stringify({
      titleSimilarity: 1,
      overviewOverlap: 0.25,
    }),
    candidateCount: 5,
    sameNormalizedTitleCount: 2,
  })

  assertEquals(vector.schemaVersion, 'candidate-features-v1')
  assertEquals(vector.values.heuristicRank, 2)
  assertEquals(vector.values.heuristicConfidence, 0.85)
  assertEquals(vector.values.queryTitleSimilarity, 1)
  assertEquals(vector.values.queryOverviewOverlap, 0.25)
  assertEquals(vector.values.exactTitleInSpan, 1)
  assertEquals(vector.values.titleMentionCount, 1)
  assertEquals(vector.values.releaseYearMentioned, 0)
  assertEquals(vector.values.comparativeContext, 1)
  assertEquals(vector.values.popularity, 11.5)
  assertEquals(Number(vector.values.logVoteCount.toFixed(4)), 7.6014)
  assertEquals(vector.values.candidateCount, 5)
  assertEquals(vector.values.sameNormalizedTitleCount, 2)
})

Deno.test('buildCandidateFeatureVectorsForSpan includes candidate context counts', () => {
  const { db } = createTestDatabase('candidate-feature-vectors')

  try {
    seed(db)
    const rows = buildCandidateFeatureVectorsForSpan(db, 'span_one')
    assertEquals(rows.length, 2)
    assertEquals(rows[0]?.features.values.candidateCount, 2)
    assertEquals(rows[0]?.features.values.sameNormalizedTitleCount, 2)
    assertEquals(rows[0]?.features.values.titleMentionCount, 2)
    assertEquals(rows[0]?.features.values.comparativeContext, 1)
    assertEquals(rows[1]?.features.values.sameNormalizedTitleCount, 2)
  } finally {
    db.close()
  }
})
