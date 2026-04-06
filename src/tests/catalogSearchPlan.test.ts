import { assertEquals } from '@std/assert'

import { chooseCatalogSearchPlan } from '../services/catalog/chooseCatalogSearchPlan.ts'

Deno.test('chooseCatalogSearchPlan routes explicit movie and TV hints directly', () => {
  assertEquals(
    chooseCatalogSearchPlan({
      mediaTypeHint: 'movie',
      qualityTier: 'low',
    }).name,
    'movie-first',
  )
  assertEquals(
    chooseCatalogSearchPlan({
      mediaTypeHint: 'tv',
      qualityTier: 'low',
    }).name,
    'tv-first',
  )
})

Deno.test('chooseCatalogSearchPlan is conservative for unknown media-type queries', () => {
  assertEquals(
    chooseCatalogSearchPlan({
      mediaTypeHint: 'unknown',
      qualityTier: 'high',
    }).name,
    'search-both',
  )
  assertEquals(
    chooseCatalogSearchPlan({
      mediaTypeHint: 'unknown',
      qualityTier: 'medium',
    }).name,
    'movie-first-tv-fallback',
  )
  assertEquals(
    chooseCatalogSearchPlan({
      mediaTypeHint: 'unknown',
      qualityTier: 'low',
    }).name,
    'movie-only',
  )
})
