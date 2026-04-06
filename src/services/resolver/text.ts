export function normalizeResolverText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim()
}

export function resolverTokens(value: string) {
  return normalizeResolverText(value).split(/\s+/).filter(Boolean)
}

export const RESOLVER_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'alright',
  'are',
  'boom',
  'but',
  'even',
  'for',
  'from',
  'hey',
  'honestly',
  'i',
  'if',
  'in',
  'into',
  "it's",
  'its',
  'just',
  'like',
  'maybe',
  'mine',
  'no',
  'of',
  'oh',
  'on',
  'or',
  'so',
  'that',
  "that's",
  'the',
  'there',
  'they',
  'this',
  'to',
  'wait',
  'watch',
  'we',
  'what',
  'when',
  'where',
  'with',
  'yeah',
  'yes',
  'you',
])

export function isResolverStopWord(value: string) {
  return RESOLVER_STOP_WORDS.has(normalizeResolverText(value))
}
