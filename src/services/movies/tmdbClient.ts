import type {
  CatalogMediaType,
  MovieCatalogRecord,
} from '../../domain/movieCatalog.ts'
import { AppError } from '../../lib/errors.ts'
import { makeId } from '../../lib/ids.ts'
import { nowIso } from '../../lib/time.ts'
import { chooseCatalogSearchPlan } from '../catalog/chooseCatalogSearchPlan.ts'
import type { ResolverQueryQualityTier } from '../resolver/queryTypes.ts'

type TmdbMovieResult = {
  id: number
  title?: string
  original_title?: string
  release_date?: string
  overview?: string
}

type TmdbTvResult = {
  id: number
  name?: string
  original_name?: string
  first_air_date?: string
  overview?: string
}

type TmdbSearchResponse = {
  results?: Array<TmdbMovieResult | TmdbTvResult>
}

export type FetchLike = typeof fetch

export type SearchTmdbMoviesOptions = {
  apiKey: string
  fetcher?: FetchLike
  now?: string
  limit?: number
}

export type TmdbWorkMediaTypeHint = CatalogMediaType | 'unknown'

export type SearchTmdbWorksOptions = SearchTmdbMoviesOptions & {
  mediaTypeHint?: TmdbWorkMediaTypeHint
  queryQualityTier?: ResolverQueryQualityTier
}

function releaseYearFromDate(releaseDate?: string) {
  const year = Number(releaseDate?.slice(0, 4))
  return Number.isInteger(year) ? year : undefined
}

function titleForResult(
  result: TmdbMovieResult | TmdbTvResult,
  mediaType: CatalogMediaType,
) {
  return mediaType === 'movie'
    ? (result as TmdbMovieResult).title
    : (result as TmdbTvResult).name
}

function originalTitleForResult(
  result: TmdbMovieResult | TmdbTvResult,
  mediaType: CatalogMediaType,
) {
  return mediaType === 'movie'
    ? (result as TmdbMovieResult).original_title
    : (result as TmdbTvResult).original_name
}

function releaseDateForResult(
  result: TmdbMovieResult | TmdbTvResult,
  mediaType: CatalogMediaType,
) {
  return mediaType === 'movie'
    ? (result as TmdbMovieResult).release_date
    : (result as TmdbTvResult).first_air_date
}

function catalogIdFor(mediaType: CatalogMediaType, sourceMovieId: string) {
  return mediaType === 'movie'
    ? makeId('movie', 'tmdb', sourceMovieId)
    : makeId('tv', 'tmdb', sourceMovieId)
}

function toCatalogRecord(
  result: TmdbMovieResult | TmdbTvResult,
  mediaType: CatalogMediaType,
  now: string,
): MovieCatalogRecord | null {
  const title = titleForResult(result, mediaType)
  if (!title) {
    return null
  }

  const sourceMovieId = String(result.id)
  const releaseDate = releaseDateForResult(result, mediaType)
  return {
    id: catalogIdFor(mediaType, sourceMovieId),
    source: 'tmdb',
    sourceMovieId,
    mediaType,
    title,
    originalTitle: originalTitleForResult(result, mediaType),
    releaseDate,
    releaseYear: releaseYearFromDate(releaseDate),
    overview: result.overview,
    metadataJson: JSON.stringify(result),
    createdAt: now,
    updatedAt: now,
  }
}

async function searchTmdbEndpoint(
  query: string,
  options: SearchTmdbMoviesOptions,
  mediaType: CatalogMediaType,
): Promise<MovieCatalogRecord[]> {
  if (!options.apiKey) {
    throw new AppError(
      'TMDB_API_KEY is required for catalog search',
      'TMDB_API_KEY_MISSING',
    )
  }

  const fetcher = options.fetcher ?? fetch
  const url = new URL(`https://api.themoviedb.org/3/search/${mediaType}`)
  url.searchParams.set('api_key', options.apiKey)
  url.searchParams.set('query', query)
  url.searchParams.set('include_adult', 'false')
  url.searchParams.set('language', 'en-US')

  const response = await fetcher(url)
  if (!response.ok) {
    throw new AppError(
      `TMDb ${mediaType} search failed with status ${response.status}`,
      'TMDB_SEARCH_FAILED',
      await response.text().catch(() => undefined),
    )
  }

  const data = await response.json() as TmdbSearchResponse
  const now = options.now ?? nowIso()
  return (data.results ?? [])
    .slice(0, options.limit ?? 10)
    .map((result) => toCatalogRecord(result, mediaType, now))
    .filter((record): record is MovieCatalogRecord => Boolean(record))
}

export async function searchTmdbMovies(
  query: string,
  options: SearchTmdbMoviesOptions,
): Promise<MovieCatalogRecord[]> {
  return await searchTmdbEndpoint(query, options, 'movie')
}

export async function searchTmdbTv(
  query: string,
  options: SearchTmdbMoviesOptions,
): Promise<MovieCatalogRecord[]> {
  return await searchTmdbEndpoint(query, options, 'tv')
}

export async function searchTmdbWorks(
  query: string,
  options: SearchTmdbWorksOptions,
): Promise<MovieCatalogRecord[]> {
  const plan = chooseCatalogSearchPlan({
    mediaTypeHint: options.mediaTypeHint ?? 'unknown',
    qualityTier: options.queryQualityTier,
  })

  if (plan.first === 'tv') {
    return await searchTmdbTv(query, options)
  }

  if (!plan.allowTvSearch) {
    return await searchTmdbMovies(query, options)
  }

  if (plan.searchBoth) {
    const [movies, tv] = await Promise.all([
      searchTmdbMovies(query, options),
      searchTmdbTv(query, options),
    ])
    return [...movies, ...tv].slice(0, options.limit ?? 10)
  }

  const movies = await searchTmdbMovies(query, options)
  if (!plan.fallbackToTvWhenMovieResultsWeak || movies.length > 0) {
    return movies
  }

  const tv = await searchTmdbTv(query, options)
  return [...movies, ...tv].slice(0, options.limit ?? 10)
}
