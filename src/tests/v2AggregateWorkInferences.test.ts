import { assertEquals } from '@std/assert'

import { aggregateWorkInferences } from '../v2/services/aggregation/aggregateWorkInferences.ts'

Deno.test('aggregateWorkInferences merges neighboring canonical matches for the same work and role', () => {
  const discussions = aggregateWorkInferences(
    [
      {
        workId: 'movie_pacific_rim',
        mediaType: 'movie',
        role: 'primary',
        windowStart: 0,
        windowEnd: 45,
        confidence: 0.9,
      },
      {
        workId: 'movie_pacific_rim',
        mediaType: 'movie',
        role: 'primary',
        windowStart: 45,
        windowEnd: 90,
        confidence: 0.8,
      },
      {
        workId: 'movie_pacific_rim',
        mediaType: 'movie',
        role: 'secondary',
        windowStart: 60,
        windowEnd: 105,
        confidence: 0.7,
      },
      {
        workId: 'movie_true_lies',
        mediaType: 'movie',
        role: 'primary',
        windowStart: 180,
        windowEnd: 225,
        confidence: 0.95,
      },
    ],
    {
      episodeId: 'ep_one',
      createdAt: '2026-01-01T00:00:00.000Z',
      maxGapSeconds: 15,
    },
  )

  assertEquals(
    discussions.map((discussion) => ({
      workId: discussion.workId,
      role: discussion.role,
      start: discussion.start,
      end: discussion.end,
      confidence: discussion.confidence,
    })),
    [
      {
        workId: 'movie_pacific_rim',
        role: 'primary',
        start: 0,
        end: 90,
        confidence: 0.85,
      },
      {
        workId: 'movie_pacific_rim',
        role: 'secondary',
        start: 60,
        end: 105,
        confidence: 0.7,
      },
      {
        workId: 'movie_true_lies',
        role: 'primary',
        start: 180,
        end: 225,
        confidence: 0.95,
      },
    ],
  )
})
