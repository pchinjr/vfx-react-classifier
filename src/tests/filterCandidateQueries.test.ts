import { assertEquals } from '@std/assert'

import { filterCandidateQueries } from '../services/resolver/filterCandidateQueries.ts'
import type { ResolverQuery } from '../services/resolver/queryTypes.ts'

function query(
  text: string,
  source: ResolverQuery['source'] = 'fallback_phrase',
): ResolverQuery {
  return {
    query: text,
    source,
    normalizedPhrase: text.toLowerCase(),
  }
}

Deno.test('filterCandidateQueries blocks known generic junk phrases', () => {
  assertEquals(
    filterCandidateQueries([
      query('Welcome'),
      query('Camera'),
      query('United States'),
      query('Visual Effects'),
    ]),
    [],
  )
})

Deno.test('filterCandidateQueries allows explicit alias-backed one-word media queries', () => {
  assertEquals(
    filterCandidateQueries([
      query('Sonic the Hedgehog', 'fallback_alias'),
    ]).map((item) => item.query),
    ['Sonic the Hedgehog'],
  )
})
