import { MEDIA_ALIAS_HINTS } from './mediaAliasHints.ts'
import type { ResolverQuery } from './queryTypes.ts'
import { normalizeResolverText } from './text.ts'

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
      })
    }
  }

  return queries
}
