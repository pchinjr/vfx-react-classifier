import { getEnv } from '../config/env.ts'
import {
  loadLogisticReranker,
  resolverVersionForModel,
} from '../services/ml/loadReranker.ts'
import { scoreCandidateSetWithModel } from '../services/ml/scoreCandidateSet.ts'
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
const modelPath = parseStringFlag(args, '--model')
const resolverVersionFlag = parseStringFlag(args, '--resolver-version')
const db = openDatabase()

try {
  initializeDatabase(db)

  if (!spanId) {
    throw new Error(
      'Usage: deno task spans:candidates --span <span-id> [--refresh]',
    )
  }

  const model = modelPath ? await loadLogisticReranker(modelPath) : null
  const resolverVersion = resolverVersionFlag ??
    (model
      ? resolverVersionForModel(SPAN_MOVIE_RESOLVER_VERSION, model)
      : SPAN_MOVIE_RESOLVER_VERSION)

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
      resolverVersion,
      searchMovies: (query) =>
        searchTmdbMovies(query, {
          apiKey: getEnv().tmdbApiKey,
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
    upsertMovieCatalogRecords(db, result.movies)
    upsertSpanMovieCandidates(db, candidates)
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
    resolverVersion,
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
        model?: { name?: string; version?: string; score?: number }
      }
      console.log(
        `evidence: query="${evidence.searchQuery ?? ''}", titleSimilarity=${
          evidence.titleSimilarity ?? 0
        }, overviewOverlap=${evidence.overviewOverlap ?? 0}`,
      )
      if (evidence.releaseYearMentioned) {
        console.log(`releaseYearMentioned: ${evidence.releaseYearMentioned}`)
      }
      if (evidence.model) {
        console.log(
          `model: ${evidence.model.name ?? 'unknown'}@${
            evidence.model.version ?? 'unknown'
          }, score=${evidence.model.score ?? 0}`,
        )
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
