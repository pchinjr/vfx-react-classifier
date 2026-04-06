import type { MovieCatalogRecord } from '../../domain/movieCatalog.ts'
import { AppError } from '../../lib/errors.ts'
import { makeId } from '../../lib/ids.ts'
import { nowIso } from '../../lib/time.ts'

type TmdbMovieResult = {
  id: number
  title?: string
  original_title?: string
  release_date?: string
  overview?: string
}

type TmdbSearchResponse = {
  results?: TmdbMovieResult[]
}

export type FetchLike = typeof fetch

export type SearchTmdbMoviesOptions = {
  apiKey: string
  fetcher?: FetchLike
  now?: string
  limit?: number
}

function releaseYearFromDate(releaseDate?: string) {
  const year = Number(releaseDate?.slice(0, 4))
  return Number.isInteger(year) ? year : undefined
}

function toMovieCatalogRecord(
  result: TmdbMovieResult,
  now: string,
): MovieCatalogRecord | null {
  if (!result.title) {
    return null
  }

  const sourceMovieId = String(result.id)
  return {
    id: makeId('movie', 'tmdb', sourceMovieId),
    source: 'tmdb',
    sourceMovieId,
    title: result.title,
    originalTitle: result.original_title,
    releaseDate: result.release_date,
    releaseYear: releaseYearFromDate(result.release_date),
    overview: result.overview,
    metadataJson: JSON.stringify(result),
    createdAt: now,
    updatedAt: now,
  }
}

export async function searchTmdbMovies(
  query: string,
  options: SearchTmdbMoviesOptions,
): Promise<MovieCatalogRecord[]> {
  if (!options.apiKey) {
    throw new AppError(
      'TMDB_API_KEY is required for movie search',
      'TMDB_API_KEY_MISSING',
    )
  }

  const fetcher = options.fetcher ?? fetch
  const url = new URL('https://api.themoviedb.org/3/search/movie')
  url.searchParams.set('api_key', options.apiKey)
  url.searchParams.set('query', query)
  url.searchParams.set('include_adult', 'false')
  url.searchParams.set('language', 'en-US')

  const response = await fetcher(url)
  if (!response.ok) {
    throw new AppError(
      `TMDb movie search failed with status ${response.status}`,
      'TMDB_SEARCH_FAILED',
      await response.text().catch(() => undefined),
    )
  }

  const data = await response.json() as TmdbSearchResponse
  const now = options.now ?? nowIso()
  return (data.results ?? [])
    .slice(0, options.limit ?? 10)
    .map((result) => toMovieCatalogRecord(result, now))
    .filter((record): record is MovieCatalogRecord => Boolean(record))
}
