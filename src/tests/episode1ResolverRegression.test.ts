import { assertEquals } from '@std/assert'

import type { DiscussionSpan } from '../domain/discussionSpan.ts'
import type { MovieCatalogRecord } from '../domain/movieCatalog.ts'
import {
  extractMovieSearchQueries,
  resolveSpanMovieCandidates,
} from '../services/movies/resolveSpanMovies.ts'

function span(text: string): DiscussionSpan {
  return {
    id: 'span_episode1',
    episodeId: 'ep_10caf82a',
    start: 0,
    end: 180,
    text,
    sourceSegmentCount: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function movie(
  id: string,
  title: string,
  overview: string,
  releaseYear?: number,
): MovieCatalogRecord {
  return {
    id,
    source: 'tmdb',
    sourceMovieId: id.replace('movie_', ''),
    title,
    originalTitle: title,
    releaseYear,
    overview,
    metadataJson: '{}',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

Deno.test('episode 1 lowercase media references produce fallback queries', () => {
  assertEquals(
    extractMovieSearchQueries(
      'game of thrones game of thrones dragon heart is a classic and sonic has weird eyes',
      5,
    ),
    ['Game of Thrones', 'Dragonheart', 'Sonic the Hedgehog'],
  )
})

Deno.test('episode 1 character and franchise references produce fallback queries', () => {
  assertEquals(
    extractMovieSearchQueries(
      'the davey jones effects are amazing in pirates of the caribbean',
      5,
    ),
    [
      'Davy Jones Pirates of the Caribbean',
      'Pirates of the Caribbean',
    ],
  )
})

Deno.test('episode 1 generic noisy span still produces no queries', () => {
  assertEquals(
    extractMovieSearchQueries(
      'welcome welcome camera camera visual effects visual effects guys guys how much how much the sack the sack',
      5,
    ),
    [],
  )
})

Deno.test('episode 1 lowercase Sonic span resolves candidates with alias evidence', async () => {
  const result = await resolveSpanMovieCandidates(
    span(
      'the sonic has very iconically large eyes and in this movie he has tiny regular eyes',
    ),
    {
      now: '2026-01-01T00:00:00.000Z',
      searchMovies: (query) =>
        query === 'Sonic the Hedgehog'
          ? [
            movie(
              'movie_sonic',
              'Sonic the Hedgehog',
              'A blue hedgehog teams up with a small-town sheriff.',
              2020,
            ),
          ]
          : [],
    },
  )

  assertEquals(result.movies.map((item) => item.title), [
    'Sonic the Hedgehog',
  ])
  assertEquals(result.candidates[0]?.rank, 1)
  assertEquals(
    JSON.parse(result.candidates[0]?.evidenceJson ?? '{}').querySource,
    'fallback_alias',
  )
})
