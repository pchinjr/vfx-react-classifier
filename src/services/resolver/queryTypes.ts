export type ResolverQuerySource =
  | 'precision'
  | 'fallback_alias'
  | 'fallback_phrase'

export type ResolverQueryMediaTypeHint = 'movie' | 'tv' | 'unknown'

export type ResolverQuery = {
  query: string
  source: ResolverQuerySource
  normalizedPhrase?: string
  confidenceHint?: number
  mediaTypeHint?: ResolverQueryMediaTypeHint
  hygieneScore?: number
  hygieneReason?: string
}
