import { assertEquals } from '@std/assert'

import type { MovieCatalogRecord } from '../domain/movieCatalog.ts'
import { shouldPersistResolvedCandidate } from '../services/resolver/filterResolvedCandidatesBeforePersist.ts'

const tv: MovieCatalogRecord = {
  id: 'tv_weak',
  source: 'tmdb',
  sourceMovieId: '1',
  mediaType: 'tv',
  title: 'Newton Cradle',
  originalTitle: 'Newton Cradle',
  releaseDate: '2020-01-01',
  releaseYear: 2020,
  overview: 'A weak match.',
  metadataJson: '{}',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

Deno.test('shouldPersistResolvedCandidate drops low-quality unknown TV candidates', () => {
  assertEquals(
    shouldPersistResolvedCandidate({
      movie: tv,
      confidence: 0.9,
      evidence: {
        searchQuery: 'Newton Cradle',
        matchedTitle: 'Newton Cradle',
        titleSimilarity: 1,
        overviewOverlap: 0,
        mediaType: 'tv',
        mediaTypeHint: 'unknown',
        queryQualityTier: 'low',
      },
    }),
    {
      keep: false,
      reason: 'low_quality_unknown_tv_candidate',
    },
  )
})

Deno.test('shouldPersistResolvedCandidate keeps explicit TV candidates', () => {
  assertEquals(
    shouldPersistResolvedCandidate({
      movie: tv,
      confidence: 0.9,
      evidence: {
        searchQuery: 'Game of Thrones',
        matchedTitle: 'Game of Thrones',
        titleSimilarity: 1,
        overviewOverlap: 0,
        mediaType: 'tv',
        mediaTypeHint: 'tv',
        queryQualityTier: 'high',
      },
    }),
    {
      keep: true,
      reason: 'passed_candidate_quality_gate',
    },
  )
})
