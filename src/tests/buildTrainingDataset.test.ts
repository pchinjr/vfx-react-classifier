import { assertEquals } from '@std/assert'

import type { DiscussionSpan } from '../domain/discussionSpan.ts'
import type { MovieCatalogRecord } from '../domain/movieCatalog.ts'
import type {
  SpanMovieCandidate,
  SpanMovieLabel,
} from '../domain/spanResolution.ts'
import {
  buildCandidateTrainingRows,
  splitForSpan,
  toJsonl,
} from '../services/ml/buildTrainingDataset.ts'
import { upsertDiscussionSpans } from '../services/storage/discussionSpansRepo.ts'
import { upsertEpisode } from '../services/storage/episodesRepo.ts'
import { upsertMovieCatalogRecords } from '../services/storage/movieCatalogRepo.ts'
import {
  upsertSpanMovieCandidates,
  upsertSpanMovieLabel,
} from '../services/storage/spanResolutionRepo.ts'
import { createTestDatabase } from '../services/storage/testDb.ts'

function discussionSpan(): DiscussionSpan {
  return {
    id: 'span_one',
    episodeId: 'ep_one',
    start: 0,
    end: 180,
    text: 'This span discusses Mortal Kombat and Independence Day.',
    sourceSegmentCount: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function movie(overrides: Partial<MovieCatalogRecord>): MovieCatalogRecord {
  return {
    id: 'movie_mortal_kombat',
    source: 'tmdb',
    sourceMovieId: '9312',
    title: 'Mortal Kombat',
    originalTitle: 'Mortal Kombat',
    releaseDate: '1995-08-18',
    releaseYear: 1995,
    overview: 'A martial artist enters a tournament.',
    metadataJson: JSON.stringify({ popularity: 12.5, vote_count: 1800 }),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function candidate(
  overrides: Partial<SpanMovieCandidate>,
): SpanMovieCandidate {
  return {
    id: 'cand_mortal_kombat',
    spanId: 'span_one',
    movieId: 'movie_mortal_kombat',
    rank: 1,
    confidence: 0.9,
    resolverVersion: 'span-movie-resolver-v1',
    evidenceJson: JSON.stringify({
      searchQuery: 'Mortal Kombat',
      titleSimilarity: 1,
      overviewOverlap: 0.2,
    }),
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function label(overrides: Partial<SpanMovieLabel> = {}): SpanMovieLabel {
  return {
    id: 'label_one',
    spanId: 'span_one',
    movieId: 'movie_mortal_kombat',
    labelSource: 'manual',
    confidence: 0.9,
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
      id: 'movie_independence_day',
      sourceMovieId: '602',
      title: 'Independence Day',
      originalTitle: 'Independence Day',
      releaseDate: '1996-06-25',
      releaseYear: 1996,
      metadataJson: JSON.stringify({ popularity: 20.5, vote_count: 9500 }),
    }),
  ])
  upsertSpanMovieCandidates(db, [
    candidate({}),
    candidate({
      id: 'cand_independence_day',
      movieId: 'movie_independence_day',
      rank: 2,
      confidence: 0.8,
      evidenceJson: JSON.stringify({
        searchQuery: 'Independence Day',
        titleSimilarity: 1,
        overviewOverlap: 0.1,
      }),
    }),
  ])
}

Deno.test('buildCandidateTrainingRows creates positive and negative rows from manual labels', () => {
  const { db } = createTestDatabase('candidate-training-rows')

  try {
    seed(db)
    upsertSpanMovieLabel(db, label())

    const rows = buildCandidateTrainingRows(db)
    assertEquals(rows.map((row) => row.candidateMovieId), [
      'movie_mortal_kombat',
      'movie_independence_day',
    ])
    assertEquals(rows.map((row) => row.label), [1, 0])
    assertEquals(rows[0]?.popularity, 12.5)
    assertEquals(rows[0]?.voteCount, 1800)
    assertEquals(rows[0]?.split, splitForSpan('span_one'))
    assertEquals(
      JSON.parse(rows[0]?.featureJson ?? '{}').values.heuristicRank,
      1,
    )
  } finally {
    db.close()
  }
})

Deno.test('buildCandidateTrainingRows ignores unlabeled spans', () => {
  const { db } = createTestDatabase('candidate-training-unlabeled')

  try {
    seed(db)
    assertEquals(buildCandidateTrainingRows(db), [])
  } finally {
    db.close()
  }
})

Deno.test('toJsonl exports deterministic newline-delimited rows', () => {
  assertEquals(
    toJsonl([
      {
        spanId: 'span_one',
        episodeId: 'ep_one',
        candidateMovieId: 'movie_one',
        label: 1,
        resolverVersion: 'resolver',
        spanText: 'text',
        movieTitle: 'Movie',
        featureJson: '{}',
        split: 'train',
      },
    ]),
    '{"spanId":"span_one","episodeId":"ep_one","candidateMovieId":"movie_one","label":1,"resolverVersion":"resolver","spanText":"text","movieTitle":"Movie","featureJson":"{}","split":"train"}\n',
  )
})
