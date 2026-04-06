import { getEnv } from '../config/env.ts'
import { makeId } from '../lib/ids.ts'
import { nowIso } from '../lib/time.ts'
import {
  loadLogisticReranker,
  resolverVersionForModel,
} from '../services/ml/loadReranker.ts'
import { scoreCandidateSetWithModel } from '../services/ml/scoreCandidateSet.ts'
import {
  resolveSpanMovieCandidates,
  SPAN_MOVIE_RESOLVER_VERSION,
} from '../services/movies/resolveSpanMovies.ts'
import { searchTmdbWorks } from '../services/movies/tmdbClient.ts'
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
const modelPath = parseStringFlag(args, '--model')
const db = openDatabase()

try {
  initializeDatabase(db)

  if (!episodeId) {
    throw new Error(
      'Usage: deno task resolve:episode --episode <episode-id>',
    )
  }

  const model = modelPath ? await loadLogisticReranker(modelPath) : null
  const resolverVersion = model
    ? resolverVersionForModel(SPAN_MOVIE_RESOLVER_VERSION, model)
    : SPAN_MOVIE_RESOLVER_VERSION
  const startedAt = nowIso()
  const runId = makeId(
    'run',
    episodeId,
    resolverVersion,
    startedAt,
  )
  createSpanResolutionRun(db, {
    id: runId,
    episodeId,
    resolverVersion,
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
        resolverVersion,
      )
    }

    for (const span of spans) {
      const result = await resolveSpanMovieCandidates(span, {
        resolverVersion,
        maxCandidates,
        maxQueries,
        searchWorks: (query) =>
          searchTmdbWorks(query.query, {
            apiKey: getEnv().tmdbApiKey,
            mediaTypeHint: query.mediaTypeHint ?? 'unknown',
            queryQualityTier: query.qualityTier,
            limit: maxCandidates,
          }),
      })
      const candidates = model
        ? scoreCandidateSetWithModel(
          span,
          result.candidates,
          result.movies,
          model,
        )
        : result.candidates

      if (candidates.length) {
        resolvedSpanCount += 1
        candidateCount += candidates.length
      }

      upsertMovieCatalogRecords(db, result.movies)
      upsertSpanMovieCandidates(db, candidates)
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
  console.log(`Resolver: ${resolverVersion}`)
  if (modelPath) {
    console.log(`Model: ${modelPath}`)
  }
  console.log(`Spans: ${spans.length}`)
  console.log(`Mode: ${force ? 'replace' : 'upsert'}`)
  console.log(`Resolved spans: ${resolvedSpanCount}`)
  console.log(`Candidates: ${candidateCount}`)
} catch (error) {
  handleCliError(error)
} finally {
  db.close()
}
