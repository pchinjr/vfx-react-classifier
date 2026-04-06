import { assertEquals, assertRejects } from '@std/assert'

import { AppError } from '../lib/errors.ts'
import { searchTmdbMovies } from '../services/movies/tmdbClient.ts'

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

Deno.test('searchTmdbMovies surfaces non-OK API responses', async () => {
  const fetcher: typeof fetch = () =>
    Promise.resolve(new Response('bad request', { status: 400 }))

  await assertRejects(
    () => searchTmdbMovies('Jurassic Park', { apiKey: 'test-key', fetcher }),
    AppError,
    'TMDb movie search failed with status 400',
  )
})
