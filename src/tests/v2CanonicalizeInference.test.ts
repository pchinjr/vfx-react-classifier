import { assertEquals } from '@std/assert'

import type { MovieCatalogRecord } from '../domain/movieCatalog.ts'
import type { WorkInference } from '../v2/domain/workInference.ts'
import { canonicalizeInference } from '../v2/services/canonicalization/canonicalizeInference.ts'

const now = '2026-01-01T00:00:00.000Z'

function inference(overrides: Partial<WorkInference> = {}): WorkInference {
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
    createdAt: now,
    ...overrides,
  }
}

function movie(
  overrides: Partial<MovieCatalogRecord> = {},
): MovieCatalogRecord {
  return {
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
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

Deno.test('canonicalizeInference chooses the strongest title match', async () => {
  const result = await canonicalizeInference(inference(), {
    now,
    searchWorks: (_query, mediaTypeHint) => {
      assertEquals(mediaTypeHint, 'movie')
      return [
        movie({
          id: 'movie_weak',
          title: 'Pacific Heights',
          originalTitle: 'Pacific Heights',
        }),
        movie(),
      ]
    },
  })

  assertEquals(result.match, {
    id: 'v2match_398ccb0e',
    inferenceId: 'inference_one',
    workId: 'movie_pacific_rim',
    matchConfidence: 0.985,
    createdAt: now,
  })
})

Deno.test('canonicalizeInference returns no match below threshold', async () => {
  const result = await canonicalizeInference(inference(), {
    now,
    minMatchConfidence: 0.99,
    searchWorks: () => [movie()],
  })

  assertEquals(result.match, undefined)
  assertEquals(result.works.length, 1)
})
