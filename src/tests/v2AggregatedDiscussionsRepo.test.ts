import { assertEquals } from '@std/assert'

import { nowIso } from '../lib/time.ts'
import { upsertEpisode } from '../services/storage/episodesRepo.ts'
import { upsertMovieCatalogRecords } from '../services/storage/movieCatalogRepo.ts'
import { createTestDatabase } from '../services/storage/testDb.ts'
import type { AggregatedDiscussion } from '../v2/domain/aggregatedDiscussion.ts'
import {
  getAggregatedDiscussionsForEpisode,
  replaceAggregatedDiscussionsForEpisode,
} from '../v2/storage/aggregatedDiscussionsRepo.ts'

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

Deno.test('aggregated discussions repo replaces episode discussions', () => {
  const { db } = createTestDatabase('v2-aggregated-discussions')

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
    replaceAggregatedDiscussionsForEpisode(db, 'ep_one', [
      {
        ...discussion('discussion_two'),
        start: 15,
        end: 105,
        confidence: 0.9,
      },
    ])

    assertEquals(
      getAggregatedDiscussionsForEpisode(db, 'ep_one').map((item) => ({
        id: item.id,
        canonicalTitle: item.canonicalTitle,
        start: item.start,
        end: item.end,
        confidence: item.confidence,
      })),
      [
        {
          id: 'discussion_two',
          canonicalTitle: 'Pacific Rim',
          start: 15,
          end: 105,
          confidence: 0.9,
        },
      ],
    )
  } finally {
    db.close()
  }
})
