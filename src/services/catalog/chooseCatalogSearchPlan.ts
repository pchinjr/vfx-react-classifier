import type { CatalogMediaType } from '../../domain/movieCatalog.ts'
import type {
  ResolverQueryMediaTypeHint,
  ResolverQueryQualityTier,
} from '../resolver/queryTypes.ts'

export type CatalogSearchPlanName =
  | 'movie-first'
  | 'tv-first'
  | 'search-both'
  | 'movie-first-tv-fallback'
  | 'movie-only'

export type CatalogSearchPlan = {
  name: CatalogSearchPlanName
  first: CatalogMediaType
  allowTvSearch: boolean
  searchBoth: boolean
  fallbackToTvWhenMovieResultsWeak: boolean
}

export type ChooseCatalogSearchPlanInput = {
  mediaTypeHint?: ResolverQueryMediaTypeHint
  qualityTier?: ResolverQueryQualityTier
}

export function chooseCatalogSearchPlan(
  input: ChooseCatalogSearchPlanInput,
): CatalogSearchPlan {
  const mediaTypeHint = input.mediaTypeHint ?? 'unknown'

  if (mediaTypeHint === 'tv') {
    return {
      name: 'tv-first',
      first: 'tv',
      allowTvSearch: true,
      searchBoth: false,
      fallbackToTvWhenMovieResultsWeak: false,
    }
  }

  if (mediaTypeHint === 'movie') {
    return {
      name: 'movie-first',
      first: 'movie',
      allowTvSearch: false,
      searchBoth: false,
      fallbackToTvWhenMovieResultsWeak: false,
    }
  }

  if (input.qualityTier === 'high') {
    return {
      name: 'search-both',
      first: 'movie',
      allowTvSearch: true,
      searchBoth: true,
      fallbackToTvWhenMovieResultsWeak: false,
    }
  }

  if (input.qualityTier === 'medium') {
    return {
      name: 'movie-first-tv-fallback',
      first: 'movie',
      allowTvSearch: true,
      searchBoth: false,
      fallbackToTvWhenMovieResultsWeak: true,
    }
  }

  return {
    name: 'movie-only',
    first: 'movie',
    allowTvSearch: false,
    searchBoth: false,
    fallbackToTvWhenMovieResultsWeak: false,
  }
}
