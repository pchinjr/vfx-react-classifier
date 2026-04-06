import type { ResolverQuery } from './queryTypes.ts'
import { scoreResolverQueryQuality } from './scoreResolverQueryQuality.ts'

export function filterResolverQueriesForLookup(queries: ResolverQuery[]) {
  return queries.flatMap((query) => {
    const quality = scoreResolverQueryQuality(query)
    if (!quality.keep) {
      return []
    }

    return [{
      ...query,
      hygieneScore: quality.score,
      hygieneReason: quality.reason,
    }]
  })
}
