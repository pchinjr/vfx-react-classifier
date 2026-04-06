import { assertEquals, assertRejects } from '@std/assert'

import { AppError } from '../lib/errors.ts'
import {
  searchTmdbMovies,
  searchTmdbTv,
  searchTmdbWorks,
} from '../services/movies/tmdbClient.ts'

Deno.test('searchTmdbMovies maps TMDb results into catalog records', async () => {
  let requestedUrl = ''
  const fetcher: typeof fetch = (input) => {
    requestedUrl = String(input)
    return Promise.resolve(
      new Response(
        JSON.stringify({
          results: [
            {
              id: 329,
              title: 'Jurassic Park',
              original_title: 'Jurassic Park',
              release_date: '1993-06-11',
              overview: 'Dinosaurs escape.',
            },
          ],
        }),
        { status: 200 },
      ),
    )
  }

  const records = await searchTmdbMovies('Jurassic Park', {
    apiKey: 'test-key',
    fetcher,
    now: '2026-01-01T00:00:00.000Z',
  })

  assertEquals(new URL(requestedUrl).searchParams.get('query'), 'Jurassic Park')
  assertEquals(new URL(requestedUrl).searchParams.get('api_key'), 'test-key')
  assertEquals(records, [
    {
      id: 'movie_6e14c0fa',
      source: 'tmdb',
      sourceMovieId: '329',
      mediaType: 'movie',
      title: 'Jurassic Park',
      originalTitle: 'Jurassic Park',
      releaseDate: '1993-06-11',
      releaseYear: 1993,
      overview: 'Dinosaurs escape.',
      metadataJson: JSON.stringify({
        id: 329,
        title: 'Jurassic Park',
        original_title: 'Jurassic Park',
        release_date: '1993-06-11',
        overview: 'Dinosaurs escape.',
      }),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ])
})

Deno.test('searchTmdbMovies requires a TMDb API key', async () => {
  await assertRejects(
    () => searchTmdbMovies('Jurassic Park', { apiKey: '' }),
    AppError,
    'TMDB_API_KEY is required',
  )
})

Deno.test('searchTmdbTv maps TMDb TV results into catalog records', async () => {
  let requestedUrl = ''
  const fetcher: typeof fetch = (input) => {
    requestedUrl = String(input)
    return Promise.resolve(
      new Response(
        JSON.stringify({
          results: [
            {
              id: 1399,
              name: 'Game of Thrones',
              original_name: 'Game of Thrones',
              first_air_date: '2011-04-17',
              overview: 'Seven noble families fight for control.',
            },
          ],
        }),
        { status: 200 },
      ),
    )
  }

  const records = await searchTmdbTv('Game of Thrones', {
    apiKey: 'test-key',
    fetcher,
    now: '2026-01-01T00:00:00.000Z',
  })

  assertEquals(new URL(requestedUrl).pathname, '/3/search/tv')
  assertEquals(records[0]?.sourceMovieId, '1399')
  assertEquals(records[0]?.mediaType, 'tv')
  assertEquals(records[0]?.title, 'Game of Thrones')
  assertEquals(records[0]?.releaseYear, 2011)
})

Deno.test('searchTmdbWorks routes by media-type hint', async () => {
  const requestedPaths: string[] = []
  const fetcher: typeof fetch = (input) => {
    requestedPaths.push(new URL(String(input)).pathname)
    return Promise.resolve(new Response(JSON.stringify({ results: [] })))
  }

  await searchTmdbWorks('Game of Thrones', {
    apiKey: 'test-key',
    fetcher,
    mediaTypeHint: 'tv',
  })
  await searchTmdbWorks('Jurassic Park', {
    apiKey: 'test-key',
    fetcher,
    mediaTypeHint: 'movie',
  })
  await searchTmdbWorks('Alien', {
    apiKey: 'test-key',
    fetcher,
    mediaTypeHint: 'unknown',
    queryQualityTier: 'high',
  })

  assertEquals(requestedPaths, [
    '/3/search/tv',
    '/3/search/movie',
    '/3/search/movie',
    '/3/search/tv',
  ])
})

Deno.test('searchTmdbWorks skips TV for low-quality unknown queries', async () => {
  const requestedPaths: string[] = []
  const fetcher: typeof fetch = (input) => {
    requestedPaths.push(new URL(String(input)).pathname)
    return Promise.resolve(new Response(JSON.stringify({ results: [] })))
  }

  await searchTmdbWorks('Newton Cradle', {
    apiKey: 'test-key',
    fetcher,
    mediaTypeHint: 'unknown',
    queryQualityTier: 'low',
  })

  assertEquals(requestedPaths, ['/3/search/movie'])
})

Deno.test('searchTmdbWorks searches TV fallback for medium-quality unknown queries only when movie results are empty', async () => {
  const emptyMoviePaths: string[] = []
  const emptyMovieFetcher: typeof fetch = (input) => {
    emptyMoviePaths.push(new URL(String(input)).pathname)
    return Promise.resolve(new Response(JSON.stringify({ results: [] })))
  }

  await searchTmdbWorks('Newton Cradle', {
    apiKey: 'test-key',
    fetcher: emptyMovieFetcher,
    mediaTypeHint: 'unknown',
    queryQualityTier: 'medium',
  })

  const movieHitPaths: string[] = []
  const movieHitFetcher: typeof fetch = (input) => {
    const path = new URL(String(input)).pathname
    movieHitPaths.push(path)
    return Promise.resolve(
      new Response(
        JSON.stringify({
          results: path === '/3/search/movie'
            ? [{ id: 1, title: 'Newton Cradle' }]
            : [],
        }),
      ),
    )
  }

  await searchTmdbWorks('Newton Cradle', {
    apiKey: 'test-key',
    fetcher: movieHitFetcher,
    mediaTypeHint: 'unknown',
    queryQualityTier: 'medium',
  })

  assertEquals(emptyMoviePaths, ['/3/search/movie', '/3/search/tv'])
  assertEquals(movieHitPaths, ['/3/search/movie'])
})

Deno.test('searchTmdbMovies surfaces non-OK API responses', async () => {
  const fetcher: typeof fetch = () =>
    Promise.resolve(new Response('bad request', { status: 400 }))

  await assertRejects(
    () => searchTmdbMovies('Jurassic Park', { apiKey: 'test-key', fetcher }),
    AppError,
    'TMDb movie search failed with status 400',
  )
})
