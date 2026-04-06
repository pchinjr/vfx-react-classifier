import type { ResolverQuery } from './queryTypes.ts'
import {
  isResolverStopWord,
  normalizeResolverText,
  resolverTokens,
} from './text.ts'

const DENYLIST = new Set([
  'camera',
  'guys',
  'united states',
  'visual effects',
  'welcome',
])

const GENERIC_FILMING_TERMS = new Set([
  'blue screen',
  'cg character',
  'cg double',
  'green screen',
  'motion capture',
  'visual effect',
])

function isStopwordHeavy(tokens: string[]) {
  if (!tokens.length) {
    return true
  }

  const stopwordCount =
    tokens.filter((token) => isResolverStopWord(token)).length
  return stopwordCount / tokens.length > 0.6
}

export function filterCandidateQueries(queries: ResolverQuery[]) {
  return queries.filter((query) => {
    const normalizedPhrase = normalizeResolverText(
      query.normalizedPhrase ?? query.query,
    )
    const tokens = resolverTokens(query.query)

    if (!normalizedPhrase || DENYLIST.has(normalizedPhrase)) {
      return false
    }

    if (GENERIC_FILMING_TERMS.has(normalizedPhrase)) {
      return false
    }

    if (query.source === 'fallback_alias') {
      return query.query.length >= 4
    }

    if (tokens.length === 1) {
      return query.query.length >= 6 && !isResolverStopWord(query.query)
    }

    return query.query.length >= 4 && !isStopwordHeavy(tokens)
  })
}
