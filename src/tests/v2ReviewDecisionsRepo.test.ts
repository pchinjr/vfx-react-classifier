import { assertEquals } from '@std/assert'

import { nowIso } from '../lib/time.ts'
import { upsertEpisode } from '../services/storage/episodesRepo.ts'
import { upsertMovieCatalogRecords } from '../services/storage/movieCatalogRepo.ts'
import { createTestDatabase } from '../services/storage/testDb.ts'
import type { AggregatedDiscussion } from '../v2/domain/aggregatedDiscussion.ts'
import {
  getReviewDecisionForTarget,
  getReviewDecisionsForEpisode,
  upsertReviewDecision,
} from '../v2/storage/reviewDecisionsRepo.ts'
import { replaceAggregatedDiscussionsForEpisode } from '../v2/storage/aggregatedDiscussionsRepo.ts'

const createdAt = '2026-01-01T00:00:00.000Z'

function discussion(id: string): AggregatedDiscussion {
  return {
    id,
    episodeId: 'ep_one',
    workId: 'movie_pacific_rim',
    mediaType: 'movie',
    start: 0,
    end: 90,
    role: 'primary',
    confidence: 0.85,
    createdAt,
  }
}

Deno.test('review decisions repo stores decisions for aggregated discussions', () => {
  const { db } = createTestDatabase('v2-review-decisions')

  try {
    upsertEpisode(db, {
      id: 'ep_one',
      youtubeVideoId: 'abc123',
      title: 'Episode',
      sourceUrl: 'https://youtube.com/watch?v=abc123',
      createdAt: nowIso(),
    })
    upsertMovieCatalogRecords(db, [
      {
        id: 'movie_pacific_rim',
        source: 'tmdb',
        sourceMovieId: '68726',
        mediaType: 'movie',
        title: 'Pacific Rim',
        originalTitle: 'Pacific Rim',
        releaseDate: '2013-07-11',
        releaseYear: 2013,
        overview: 'Kaiju and jaegers.',
        metadataJson: '{}',
        createdAt,
        updatedAt: createdAt,
      },
    ])
    replaceAggregatedDiscussionsForEpisode(db, 'ep_one', [
      discussion('discussion_one'),
    ])

    upsertReviewDecision(db, {
      id: 'review_one',
      targetType: 'discussion',
      targetId: 'discussion_one',
      decision: 'confirmed',
      workId: 'movie_pacific_rim',
      notes: 'Primary discussion is correct.',
      createdAt,
    })

    assertEquals(
      getReviewDecisionForTarget(db, 'discussion', 'discussion_one')
        ?.decision,
      'confirmed',
    )
    assertEquals(
      getReviewDecisionsForEpisode(db, 'ep_one').map((decision) => ({
        id: decision.id,
        targetType: decision.targetType,
        targetId: decision.targetId,
        decision: decision.decision,
        workId: decision.workId,
      })),
      [
        {
          id: 'review_one',
          targetType: 'discussion',
          targetId: 'discussion_one',
          decision: 'confirmed',
          workId: 'movie_pacific_rim',
        },
      ],
    )
  } finally {
    db.close()
  }
})
