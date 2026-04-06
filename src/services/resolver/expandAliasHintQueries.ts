import { MEDIA_ALIAS_HINTS } from './mediaAliasHints.ts'
import type { ResolverQuery, ResolverQueryMediaTypeHint } from './queryTypes.ts'
import { normalizeResolverText } from './text.ts'

function resolverMediaTypeHint(
  hint: string | undefined,
): ResolverQueryMediaTypeHint | undefined {
  if (hint === 'movie' || hint === 'tv') {
    return hint
  }

  if (hint === 'franchise' || hint === 'character') {
    return 'movie'
  }

  return undefined
}

export function expandAliasHintQueries(text: string) {
  const normalizedText = ` ${normalizeResolverText(text)} `
  const queries: ResolverQuery[] = []

  for (const hint of MEDIA_ALIAS_HINTS) {
    if (!hint.enabled) {
      continue
    }

    const normalizedPhrase = normalizeResolverText(hint.normalizedPhrase)
    if (!normalizedText.includes(` ${normalizedPhrase} `)) {
      continue
    }

    for (const query of hint.lookupQueries) {
      queries.push({
        query,
        source: 'fallback_alias',
        normalizedPhrase,
        confidenceHint: 0.8 + (hint.confidenceBoost ?? 0),
        mediaTypeHint: resolverMediaTypeHint(hint.mediaTypeHint),
      })
    }
  }

  return queries
}
