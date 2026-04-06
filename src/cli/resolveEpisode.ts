import { getEnv } from '../config/env.ts'
import { makeId } from '../lib/ids.ts'
import { nowIso } from '../lib/time.ts'
import {
  resolveSpanMovieCandidates,
  SPAN_MOVIE_RESOLVER_VERSION,
} from '../services/movies/resolveSpanMovies.ts'
import { searchTmdbMovies } from '../services/movies/tmdbClient.ts'
import { initializeDatabase, openDatabase } from '../services/storage/db.ts'
import { getDiscussionSpansForEpisode } from '../services/storage/discussionSpansRepo.ts'
import { upsertMovieCatalogRecords } from '../services/storage/movieCatalogRepo.ts'
import {
  completeSpanResolutionRun,
  createSpanResolutionRun,
  deleteSpanMovieCandidatesForEpisode,
  upsertSpanMovieCandidates,
} from '../services/storage/spanResolutionRepo.ts'
import {
  handleCliError,
  parseBooleanFlag,
  parseNumberFlag,
  parseStringFlag,
} from './shared.ts'

const args = [...Deno.args]
const episodeId = parseStringFlag(args, '--episode')
const maxCandidates = parseNumberFlag(args, '--max-candidates') ?? 5
const maxQueries = parseNumberFlag(args, '--max-queries') ?? 3
const force = parseBooleanFlag(args, '--force')
const db = openDatabase()

try {
  initializeDatabase(db)

  if (!episodeId) {
    throw new Error(
      'Usage: deno task resolve:episode --episode <episode-id>',
    )
  }

  const startedAt = nowIso()
  const runId = makeId(
    'run',
    episodeId,
    SPAN_MOVIE_RESOLVER_VERSION,
    startedAt,
  )
  createSpanResolutionRun(db, {
    id: runId,
    episodeId,
    resolverVersion: SPAN_MOVIE_RESOLVER_VERSION,
    startedAt,
    status: 'running',
  })

  const spans = getDiscussionSpansForEpisode(db, episodeId)
  let resolvedSpanCount = 0
  let candidateCount = 0

  try {
    if (force) {
      deleteSpanMovieCandidatesForEpisode(
        db,
        episodeId,
        SPAN_MOVIE_RESOLVER_VERSION,
      )
    }

    for (const span of spans) {
      const result = await resolveSpanMovieCandidates(span, {
        maxCandidates,
        maxQueries,
        searchMovies: (query) =>
          searchTmdbMovies(query, {
            apiKey: getEnv().tmdbApiKey,
            limit: maxCandidates,
          }),
      })

      if (result.candidates.length) {
        resolvedSpanCount += 1
        candidateCount += result.candidates.length
      }

      upsertMovieCatalogRecords(db, result.movies)
      upsertSpanMovieCandidates(db, result.candidates)
    }

    completeSpanResolutionRun(
      db,
      runId,
      'completed',
      nowIso(),
      `Resolved ${resolvedSpanCount}/${spans.length} spans`,
    )
  } catch (error) {
    completeSpanResolutionRun(
      db,
      runId,
      'failed',
      nowIso(),
      error instanceof Error ? error.message : String(error),
    )
    throw error
  }

  console.log(`Episode: ${episodeId}`)
  console.log(`Run: ${runId}`)
  console.log(`Resolver: ${SPAN_MOVIE_RESOLVER_VERSION}`)
  console.log(`Spans: ${spans.length}`)
  console.log(`Mode: ${force ? 'replace' : 'upsert'}`)
  console.log(`Resolved spans: ${resolvedSpanCount}`)
  console.log(`Candidates: ${candidateCount}`)
} catch (error) {
  handleCliError(error)
} finally {
  db.close()
}
