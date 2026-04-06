import { assertEquals } from '@std/assert'

import type { DiscussionSpan } from '../domain/discussionSpan.ts'
import type { MovieCatalogRecord } from '../domain/movieCatalog.ts'
import {
  extractMovieSearchQueries,
  isResolvableSpan,
  resolveSpanMovieCandidates,
} from '../services/movies/resolveSpanMovies.ts'

function span(text: string): DiscussionSpan {
  return {
    id: 'span_one',
    episodeId: 'ep_one',
    start: 0,
    end: 180,
    text,
    sourceSegmentCount: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function movie(
  overrides: Partial<MovieCatalogRecord> = {},
): MovieCatalogRecord {
  return {
    id: 'movie_jurassic',
    source: 'tmdb',
    sourceMovieId: '329',
    title: 'Jurassic Park',
    originalTitle: 'Jurassic Park',
    releaseDate: '1993-06-11',
    releaseYear: 1993,
    overview: 'A dinosaur theme park suffers a major systems failure.',
    metadataJson: '{}',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

Deno.test('extractMovieSearchQueries finds title-like phrases', () => {
  assertEquals(
    extractMovieSearchQueries(
      'They compare Jurassic Park and Independence Day in this shot.',
    ),
    ['Jurassic Park', 'Independence Day'],
  )
})

Deno.test('extractMovieSearchQueries rejects generic single-word sentence starts', () => {
  assertEquals(
    extractMovieSearchQueries(
      'Welcome back. Even this shot has Watch and Camera as sentence starts.',
    ),
    [],
  )
})

Deno.test('extractMovieSearchQueries caps phrase length to keep adjacent names separate', () => {
  assertEquals(
    extractMovieSearchQueries('so Air Force One Harrison Ford is the setup.'),
    ['Air Force One', 'Harrison Ford'],
  )
})

Deno.test('isResolvableSpan rejects tiny generic spans', () => {
  assertEquals(isResolvableSpan(span('short')), false)
})

Deno.test('resolveSpanMovieCandidates ranks candidates with evidence JSON', async () => {
  const result = await resolveSpanMovieCandidates(
    span(
      'The Jurassic Park 1993 dinosaur scene works because the practical lighting sells the effect.',
    ),
    {
      now: '2026-01-01T00:00:00.000Z',
      searchMovies: (query) => {
        if (query === 'Jurassic Park') {
          return [
            movie(),
            movie({
              id: 'movie_world',
              sourceMovieId: '135397',
              title: 'Jurassic World',
              originalTitle: 'Jurassic World',
              releaseDate: '2015-06-12',
              releaseYear: 2015,
            }),
          ]
        }

        return []
      },
    },
  )

  assertEquals(result.movies.map((item) => item.title), [
    'Jurassic Park',
  ])
  assertEquals(result.candidates[0]?.movieId, 'movie_jurassic')
  assertEquals(result.candidates[0]?.rank, 1)
  assertEquals(result.candidates[0]?.resolverVersion, 'span-movie-resolver-v1')
  assertEquals(JSON.parse(result.candidates[0]?.evidenceJson ?? '{}'), {
    searchQuery: 'Jurassic Park',
    matchedTitle: 'Jurassic Park',
    titleSimilarity: 1,
    overviewOverlap: 0.1667,
    releaseYearMentioned: 1993,
  })
})

Deno.test('resolveSpanMovieCandidates rejects weak title matches', async () => {
  const result = await resolveSpanMovieCandidates(
    span(
      "Boom It's a magic trick, but this sentence starter is not a real movie title.",
    ),
    {
      searchMovies: () => [
        movie({
          id: 'movie_boom',
          sourceMovieId: '123',
          title: 'The Boom',
          originalTitle: 'The Boom',
        }),
      ],
    },
  )

  assertEquals(result.movies, [])
  assertEquals(result.candidates, [])
})
