import type { ResolverQuery } from './queryTypes.ts'
import { isResolverStopWord, normalizeResolverText } from './text.ts'

const NON_MOVIE_PHRASES = new Set([
  'internet alright',
  'oval office',
  'united states',
  'video copilot',
])

export function extractPrecisionQueriesFromSpanText(text: string) {
  const matches = text.matchAll(
    /\b(?:[A-Z][A-Za-z0-9'&:-]*|[0-9]+)(?:\s+(?:[A-Z][A-Za-z0-9'&:-]*|[0-9]+)){0,2}/g,
  )
  const queries: ResolverQuery[] = []

  for (const match of matches) {
    const words = match[0].trim().split(/\s+/)
    while (words.length && isResolverStopWord(words[0])) {
      words.shift()
    }
    while (words.length && isResolverStopWord(words.at(-1) ?? '')) {
      words.pop()
    }

    const query = words.join(' ').trim()
    const normalizedPhrase = normalizeResolverText(query)
    if (
      query.length < 4 ||
      NON_MOVIE_PHRASES.has(normalizedPhrase) ||
      words.length < 2 ||
      words.every((word) => isResolverStopWord(word))
    ) {
      continue
    }

    queries.push({
      query,
      source: 'precision',
      normalizedPhrase,
      confidenceHint: 1,
    })
  }

  return queries
}
