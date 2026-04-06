import type { ResolverQuery } from './queryTypes.ts'
import { classifyResolverQueryQuality } from './classifyResolverQueryQuality.ts'
import { normalizeResolverText, resolverTokens } from './text.ts'

const BLOCKED_PRECISION_QUERIES = new Set([
  'stick around',
  'visual effects artists',
  'will smith',
  'will smith budapest',
])

const LOCATION_TOKENS = new Set([
  'budapest',
])

const PERSON_CONTEXT_TOKENS = new Set([
  'andrew',
  'blender',
  'guru',
  'smith',
  'will',
])

export type ResolverQueryQuality = {
  keep: boolean
  score: number
  tier: 'high' | 'medium' | 'low'
  reason: string
}

function result(
  keep: boolean,
  score: number,
  reason: string,
): ResolverQueryQuality {
  return {
    keep,
    score,
    tier: classifyResolverQueryQuality(score),
    reason,
  }
}

function hasPersonLocationShape(tokens: string[]) {
  const hasPersonContext = tokens.some((token) =>
    PERSON_CONTEXT_TOKENS.has(token)
  )
  const hasLocation = tokens.some((token) => LOCATION_TOKENS.has(token))
  return hasPersonContext && hasLocation
}

export function scoreResolverQueryQuality(
  query: ResolverQuery,
): ResolverQueryQuality {
  const normalizedPhrase = normalizeResolverText(
    query.normalizedPhrase ?? query.query,
  )
  const tokens = resolverTokens(query.query)

  if (query.source === 'fallback_alias') {
    return result(true, 1, 'alias_backed')
  }

  if (BLOCKED_PRECISION_QUERIES.has(normalizedPhrase)) {
    return result(false, 0, 'blocked_known_noisy_precision_query')
  }

  if (query.source === 'precision' && hasPersonLocationShape(tokens)) {
    return result(false, 0.1, 'person_location_context_phrase')
  }

  if (tokens.length >= 2) {
    return result(true, 0.8, 'title_shaped_phrase')
  }

  return result(false, 0.2, 'low_information_query')
}
