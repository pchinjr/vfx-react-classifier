import { extractLowercaseFallbackQueriesFromSpanText } from './extractLowercaseFallbackQueriesFromSpanText.ts'
import { extractPrecisionQueriesFromSpanText } from './extractPrecisionQueriesFromSpanText.ts'
import { filterCandidateQueries } from './filterCandidateQueries.ts'
import type { ResolverQuery } from './queryTypes.ts'
import { normalizeResolverText } from './text.ts'

export type BuildResolverQueriesOptions = {
  maxQueries?: number
  fallbackThreshold?: number
}

function dedupeQueries(queries: ResolverQuery[]) {
  const seen = new Set<string>()
  const result: ResolverQuery[] = []

  for (const query of queries) {
    const key = normalizeResolverText(query.query)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(query)
  }

  return result
}

export function buildResolverQueries(
  text: string,
  options: BuildResolverQueriesOptions = {},
) {
  const maxQueries = options.maxQueries ?? 3
  const fallbackThreshold = options.fallbackThreshold ?? 1
  const precisionQueries = filterCandidateQueries(
    extractPrecisionQueriesFromSpanText(text),
  )

  const fallbackQueries = precisionQueries.length < fallbackThreshold
    ? filterCandidateQueries(extractLowercaseFallbackQueriesFromSpanText(text))
    : []

  return dedupeQueries([
    ...precisionQueries,
    ...fallbackQueries,
  ]).slice(0, maxQueries)
}
