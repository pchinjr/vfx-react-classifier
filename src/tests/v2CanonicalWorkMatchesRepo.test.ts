import { assertEquals } from '@std/assert'

import { nowIso } from '../lib/time.ts'
import { upsertEpisode } from '../services/storage/episodesRepo.ts'
import { upsertMovieCatalogRecords } from '../services/storage/movieCatalogRepo.ts'
import { createTestDatabase } from '../services/storage/testDb.ts'
import type { InferenceWindow } from '../v2/domain/inferenceWindow.ts'
import type { WorkInference } from '../v2/domain/workInference.ts'
import {
  deleteCanonicalWorkMatchesForEpisode,
  getCanonicalWorkMatchesForEpisode,
  upsertCanonicalWorkMatches,
} from '../v2/storage/canonicalWorkMatchesRepo.ts'
import { upsertInferenceWindows } from '../v2/storage/inferenceWindowsRepo.ts'
import { upsertWorkInferences } from '../v2/storage/workInferencesRepo.ts'

const createdAt = '2026-01-01T00:00:00.000Z'

function window(): InferenceWindow {
  return {
    id: 'window_one',
    episodeId: 'ep_one',
    start: 0,
    end: 45,
    text: 'Pacific Rim',
    createdAt,
  }
}

function inference(): WorkInference {
  return {
    id: 'inference_one',
    windowId: 'window_one',
    titleGuess: 'Pacific Rim',
    mediaType: 'movie',
    role: 'primary',
    confidence: 0.9,
    evidence: ['Pacific Rim'],
    modelVersion: 'test-model',
    promptVersion: 'test-prompt',
    createdAt,
  }
}

Deno.test('canonical work match repo stores and deletes episode matches', () => {
  const { db } = createTestDatabase('v2-canonical-work-matches')

  try {
    upsertEpisode(db, {
      id: 'ep_one',
      youtubeVideoId: 'abc123',
      title: 'Episode',
      sourceUrl: 'https://youtube.com/watch?v=abc123',
      createdAt: nowIso(),
    })
    upsertInferenceWindows(db, [window()])
    upsertWorkInferences(db, [inference()])
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

    upsertCanonicalWorkMatches(db, [
      {
        id: 'match_one',
        inferenceId: 'inference_one',
        workId: 'movie_pacific_rim',
        matchConfidence: 0.98,
        createdAt,
      },
    ])

    assertEquals(
      getCanonicalWorkMatchesForEpisode(db, 'ep_one').map((item) => ({
        titleGuess: item.titleGuess,
        canonicalTitle: item.canonicalTitle,
        mediaType: item.mediaType,
        matchConfidence: item.matchConfidence,
      })),
      [
        {
          titleGuess: 'Pacific Rim',
          canonicalTitle: 'Pacific Rim',
          mediaType: 'movie',
          matchConfidence: 0.98,
        },
      ],
    )

    deleteCanonicalWorkMatchesForEpisode(db, 'ep_one')
    assertEquals(getCanonicalWorkMatchesForEpisode(db, 'ep_one'), [])
  } finally {
    db.close()
  }
})
