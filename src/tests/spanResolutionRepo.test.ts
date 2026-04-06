import { assertEquals } from '@std/assert'

import type { DiscussionSpan } from '../domain/discussionSpan.ts'
import type { MovieCatalogRecord } from '../domain/movieCatalog.ts'
import type {
  SpanMovieCandidate,
  SpanMovieLabel,
} from '../domain/spanResolution.ts'
import { nowIso } from '../lib/time.ts'
import { upsertDiscussionSpans } from '../services/storage/discussionSpansRepo.ts'
import { upsertEpisode } from '../services/storage/episodesRepo.ts'
import { upsertMovieCatalogRecords } from '../services/storage/movieCatalogRepo.ts'
import {
  completeSpanResolutionRun,
  countSpanMovieCandidatesForEpisode,
  countSpanMovieLabelsForEpisode,
  createSpanResolutionRun,
  deleteSpanMovieCandidatesForEpisode,
  getEpisodeSpanResolutionRows,
  getLatestSpanResolutionRunForEpisode,
  getSpanMovieCandidateByRank,
  getSpanMovieCandidates,
  getSpanMovieLabel,
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
    text: 'Jurassic Park discussion',
    sourceSegmentCount: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function movie(): MovieCatalogRecord {
  return {
    id: 'movie_jurassic',
    source: 'tmdb',
    sourceMovieId: '329',
    mediaType: 'movie',
    title: 'Jurassic Park',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function candidate(
  overrides: Partial<SpanMovieCandidate> = {},
): SpanMovieCandidate {
  return {
    id: 'cand_one',
    spanId: 'span_one',
    movieId: 'movie_jurassic',
    rank: 1,
    confidence: 0.9,
    resolverVersion: 'span-movie-resolver-v1',
    evidenceJson: '{}',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function label(overrides: Partial<SpanMovieLabel> = {}): SpanMovieLabel {
  return {
    id: 'label_one',
    spanId: 'span_one',
    movieId: 'movie_jurassic',
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
    createdAt: nowIso(),
  })
  upsertDiscussionSpans(db, [discussionSpan()])
  upsertMovieCatalogRecords(db, [movie()])
}

Deno.test('span resolution runs can be completed', () => {
  const { db } = createTestDatabase('span-resolution-run')

  try {
    seed(db)
    createSpanResolutionRun(db, {
      id: 'run_one',
      episodeId: 'ep_one',
      resolverVersion: 'span-movie-resolver-v1',
      startedAt: '2026-01-01T00:00:00.000Z',
      status: 'running',
    })
    completeSpanResolutionRun(
      db,
      'run_one',
      'completed',
      '2026-01-01T00:01:00.000Z',
      'ok',
    )

    assertEquals(
      db.queryEntries<{ status: string; notes: string }>(
        'SELECT status, notes FROM span_resolution_runs WHERE id = ?',
        ['run_one'],
      )[0],
      { status: 'completed', notes: 'ok' },
    )
    assertEquals(
      getLatestSpanResolutionRunForEpisode(db, 'ep_one')?.status,
      'completed',
    )
  } finally {
    db.close()
  }
})

Deno.test('upsertSpanMovieCandidates is safe across resolver reruns', () => {
  const { db } = createTestDatabase('span-resolution-candidates')

  try {
    seed(db)
    upsertSpanMovieCandidates(db, [candidate()])
    upsertSpanMovieCandidates(db, [candidate({ confidence: 0.8 })])

    const candidates = getSpanMovieCandidates(db, 'span_one')
    assertEquals(candidates.length, 1)
    assertEquals(candidates[0]?.confidence, 0.8)
    assertEquals(countSpanMovieCandidatesForEpisode(db, 'ep_one'), 1)
  } finally {
    db.close()
  }
})

Deno.test('getSpanMovieCandidateByRank finds the selected candidate', () => {
  const { db } = createTestDatabase('span-resolution-candidate-by-rank')

  try {
    seed(db)
    upsertSpanMovieCandidates(db, [
      candidate({ id: 'cand_two', rank: 2, confidence: 0.7 }),
      candidate({ rank: 1, confidence: 0.9 }),
    ])

    const selected = getSpanMovieCandidateByRank(
      db,
      'span_one',
      1,
      'span-movie-resolver-v1',
    )
    assertEquals(selected?.movieTitle, 'Jurassic Park')
    assertEquals(selected?.rank, 1)
  } finally {
    db.close()
  }
})

Deno.test('upsertSpanMovieLabel keeps one confirmed label per span', () => {
  const { db } = createTestDatabase('span-resolution-label')

  try {
    seed(db)
    upsertSpanMovieLabel(db, label())
    upsertSpanMovieLabel(
      db,
      label({ confidence: 0.8, createdAt: '2026-01-01T00:01:00.000Z' }),
    )

    const confirmed = getSpanMovieLabel(db, 'span_one')
    assertEquals(confirmed?.movieTitle, 'Jurassic Park')
    assertEquals(confirmed?.confidence, 0.8)
    assertEquals(confirmed?.labelSource, 'manual')
    assertEquals(countSpanMovieLabelsForEpisode(db, 'ep_one'), 1)
  } finally {
    db.close()
  }
})

Deno.test('getEpisodeSpanResolutionRows returns report rows', () => {
  const { db } = createTestDatabase('span-resolution-report-rows')

  try {
    seed(db)
    upsertSpanMovieCandidates(db, [candidate()])
    upsertSpanMovieLabel(db, label())

    const rows = getEpisodeSpanResolutionRows(db, 'ep_one')
    assertEquals(rows.length, 1)
    assertEquals(rows[0]?.spanId, 'span_one')
    assertEquals(rows[0]?.candidateCount, 1)
    assertEquals(rows[0]?.topCandidateTitle, 'Jurassic Park')
    assertEquals(rows[0]?.labelTitle, 'Jurassic Park')
    assertEquals(rows[0]?.labelSource, 'manual')
  } finally {
    db.close()
  }
})

Deno.test('episode report candidate queries can be scoped to resolver version', () => {
  const { db } = createTestDatabase('span-resolution-report-resolver-filter')

  try {
    seed(db)
    upsertSpanMovieCandidates(db, [
      candidate({ resolverVersion: 'span-movie-resolver-v1' }),
      candidate({
        id: 'cand_model',
        resolverVersion: 'span-movie-resolver-v1+candidate-reranker@test',
        confidence: 0.95,
      }),
    ])

    const resolverVersion = 'span-movie-resolver-v1+candidate-reranker@test'
    const rows = getEpisodeSpanResolutionRows(db, 'ep_one', resolverVersion)

    assertEquals(countSpanMovieCandidatesForEpisode(db, 'ep_one'), 2)
    assertEquals(
      countSpanMovieCandidatesForEpisode(db, 'ep_one', resolverVersion),
      1,
    )
    assertEquals(rows.length, 1)
    assertEquals(rows[0]?.spanId, 'span_one')
    assertEquals(rows[0]?.candidateCount, 1)
    assertEquals(rows[0]?.topCandidateConfidence, 0.95)
  } finally {
    db.close()
  }
})

Deno.test('deleteSpanMovieCandidatesForEpisode clears one resolver version', () => {
  const { db } = createTestDatabase('span-resolution-delete-candidates')

  try {
    seed(db)
    upsertSpanMovieCandidates(db, [
      candidate(),
      candidate({
        id: 'cand_other_version',
        resolverVersion: 'span-movie-resolver-v2',
      }),
    ])

    deleteSpanMovieCandidatesForEpisode(
      db,
      'ep_one',
      'span-movie-resolver-v1',
    )

    const remaining = getSpanMovieCandidates(db, 'span_one')
    assertEquals(remaining.length, 1)
    assertEquals(remaining[0]?.resolverVersion, 'span-movie-resolver-v2')
  } finally {
    db.close()
  }
})

Deno.test('deleteSpanMovieCandidatesForEpisode preserves manual labels', () => {
  const { db } = createTestDatabase('span-resolution-delete-preserves-label')

  try {
    seed(db)
    upsertSpanMovieCandidates(db, [candidate()])
    upsertSpanMovieLabel(db, label())

    deleteSpanMovieCandidatesForEpisode(
      db,
      'ep_one',
      'span-movie-resolver-v1',
    )

    assertEquals(getSpanMovieCandidates(db, 'span_one'), [])
    assertEquals(getSpanMovieLabel(db, 'span_one')?.movieTitle, 'Jurassic Park')
  } finally {
    db.close()
  }
})
