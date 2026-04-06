import { assertEquals } from '@std/assert'

import { buildResolverQueries } from '../services/resolver/buildResolverQueries.ts'
import { extractPrecisionQueriesFromSpanText } from '../services/resolver/extractPrecisionQueriesFromSpanText.ts'

Deno.test('extractPrecisionQueriesFromSpanText preserves clean title-like behavior', () => {
  assertEquals(
    extractPrecisionQueriesFromSpanText(
      'They compare Jurassic Park and Independence Day in this shot.',
    ).map((query) => query.query),
    ['Jurassic Park', 'Independence Day'],
  )
})

Deno.test('buildResolverQueries uses fallback aliases only when precision is empty', () => {
  assertEquals(
    buildResolverQueries('game of thrones and sonic are both lowercase').map(
      (query) => [query.query, query.source],
    ),
    [
      ['Game of Thrones', 'fallback_alias'],
      ['Sonic the Hedgehog', 'fallback_alias'],
    ],
  )
})

Deno.test('buildResolverQueries does not add fallback when precision already succeeds', () => {
  assertEquals(
    buildResolverQueries('Jurassic Park and sonic are both mentioned.').map((
      query,
    ) => [query.query, query.source]),
    [['Jurassic Park', 'precision']],
  )
})

Deno.test('buildResolverQueries deduplicates repeated alias lookup queries', () => {
  assertEquals(
    buildResolverQueries(
      'davey jones appears in pirates of the caribbean with davey jones.',
      { maxQueries: 5 },
    ).map((query) => query.query),
    [
      'Davy Jones Pirates of the Caribbean',
      'Pirates of the Caribbean',
    ],
  )
})
