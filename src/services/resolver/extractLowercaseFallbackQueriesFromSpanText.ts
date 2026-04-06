import { expandAliasHintQueries } from './expandAliasHintQueries.ts'

export function extractLowercaseFallbackQueriesFromSpanText(text: string) {
  return expandAliasHintQueries(text)
}
