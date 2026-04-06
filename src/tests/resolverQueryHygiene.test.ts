import { assertEquals } from '@std/assert'

import { filterResolverQueriesForLookup } from '../services/resolver/filterResolverQueriesForLookup.ts'
import { scoreResolverQueryQuality } from '../services/resolver/scoreResolverQueryQuality.ts'
import type { ResolverQuery } from '../services/resolver/queryTypes.ts'

function query(
  text: string,
  source: ResolverQuery['source'] = 'precision',
): ResolverQuery {
  return {
    query: text,
    source,
    normalizedPhrase: text.toLowerCase(),
    mediaTypeHint: source === 'fallback_alias' ? 'tv' : 'unknown',
  }
}

Deno.test('scoreResolverQueryQuality blocks known noisy precision queries', () => {
  assertEquals(scoreResolverQueryQuality(query('Will Smith Budapest')), {
    keep: false,
    score: 0,
    tier: 'low',
    reason: 'blocked_known_noisy_precision_query',
  })
  assertEquals(scoreResolverQueryQuality(query('Will Smith')).keep, false)
  assertEquals(scoreResolverQueryQuality(query('Stick Around')).keep, false)
})

Deno.test('filterResolverQueriesForLookup keeps alias-backed TV queries', () => {
  const kept = filterResolverQueriesForLookup([
    query('Game of Thrones', 'fallback_alias'),
  ])

  assertEquals(
    kept.map((item) => ({
      query: item.query,
      mediaTypeHint: item.mediaTypeHint,
      qualityTier: item.qualityTier,
      hygieneReason: item.hygieneReason,
    })),
    [
      {
        query: 'Game of Thrones',
        mediaTypeHint: 'tv',
        qualityTier: 'high',
        hygieneReason: 'alias_backed',
      },
    ],
  )
})

Deno.test('filterResolverQueriesForLookup attaches medium quality to title-shaped precision queries', () => {
  const kept = filterResolverQueriesForLookup([
    query('Newton Cradle', 'precision'),
  ])

  assertEquals(kept[0]?.qualityTier, 'medium')
  assertEquals(kept[0]?.hygieneReason, 'title_shaped_phrase')
})
