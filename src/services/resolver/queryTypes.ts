export type ResolverQuerySource =
  | 'precision'
  | 'fallback_alias'
  | 'fallback_phrase'

export type ResolverQuery = {
  query: string
  source: ResolverQuerySource
  normalizedPhrase?: string
  confidenceHint?: number
}
