import { getEnv } from '../config/env.ts'
import {
  resolveSpanMovieCandidates,
  SPAN_MOVIE_RESOLVER_VERSION,
} from '../services/movies/resolveSpanMovies.ts'
import { searchTmdbMovies } from '../services/movies/tmdbClient.ts'
import { initializeDatabase, openDatabase } from '../services/storage/db.ts'
import { upsertMovieCatalogRecords } from '../services/storage/movieCatalogRepo.ts'
import {
  getSpanMovieCandidates,
  getSpanMovieLabel,
  upsertSpanMovieCandidates,
} from '../services/storage/spanResolutionRepo.ts'
import { handleCliError, parseBooleanFlag, parseStringFlag } from './shared.ts'

const args = [...Deno.args]
const spanId = parseStringFlag(args, '--span')
const refresh = parseBooleanFlag(args, '--refresh')
const db = openDatabase()

try {
  initializeDatabase(db)

  if (!spanId) {
    throw new Error(
      'Usage: deno task spans:candidates --span <span-id> [--refresh]',
    )
  }

  if (refresh) {
    const span = db.queryEntries<{
      id: string
      episodeId: string
      start: number
      end: number
      text: string
      sourceSegmentCount: number
      createdAt: string
    }>(
      `
      SELECT
        id,
        episode_id AS episodeId,
        start,
        end,
        text,
        source_segment_count AS sourceSegmentCount,
        created_at AS createdAt
      FROM discussion_spans
      WHERE id = ?
      LIMIT 1
      `,
      [spanId],
    )[0]

    if (!span) {
      throw new Error(`Span not found: ${spanId}`)
    }

    const result = await resolveSpanMovieCandidates(span, {
      searchMovies: (query) =>
        searchTmdbMovies(query, {
          apiKey: getEnv().tmdbApiKey,
        }),
    })
    upsertMovieCatalogRecords(db, result.movies)
    upsertSpanMovieCandidates(db, result.candidates)
  }

  const label = getSpanMovieLabel(db, spanId)
  if (label) {
    console.log(
      `Label: ${label.movieTitle} | ${label.labelSource} | confidence=${
        label.confidence.toFixed(4)
      }`,
    )
    console.log('')
  }

  const candidates = getSpanMovieCandidates(
    db,
    spanId,
    SPAN_MOVIE_RESOLVER_VERSION,
  )
  if (!candidates.length) {
    console.log('No candidates found.')
  } else {
    for (const candidate of candidates) {
      console.log(
        `#${candidate.rank} | ${candidate.movieTitle} | confidence=${
          candidate.confidence.toFixed(4)
        } | ${candidate.resolverVersion}`,
      )

      const evidence = JSON.parse(candidate.evidenceJson) as {
        searchQuery?: string
        matchedTitle?: string
        titleSimilarity?: number
        overviewOverlap?: number
        releaseYearMentioned?: number
      }
      console.log(
        `evidence: query="${evidence.searchQuery ?? ''}", titleSimilarity=${
          evidence.titleSimilarity ?? 0
        }, overviewOverlap=${evidence.overviewOverlap ?? 0}`,
      )
      if (evidence.releaseYearMentioned) {
        console.log(`releaseYearMentioned: ${evidence.releaseYearMentioned}`)
      }
      console.log(`created: ${candidate.createdAt}`)
      console.log('')
    }
  }
} catch (error) {
  handleCliError(error)
} finally {
  db.close()
}
