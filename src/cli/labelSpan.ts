import { makeId } from '../lib/ids.ts'
import { nowIso } from '../lib/time.ts'
import { SPAN_MOVIE_RESOLVER_VERSION } from '../services/movies/resolveSpanMovies.ts'
import { initializeDatabase, openDatabase } from '../services/storage/db.ts'
import {
  getSpanMovieCandidateByRank,
  upsertSpanMovieLabel,
} from '../services/storage/spanResolutionRepo.ts'
import { handleCliError, parseNumberFlag, parseStringFlag } from './shared.ts'

const args = [...Deno.args]
const spanId = parseStringFlag(args, '--span')
const candidateRank = parseNumberFlag(args, '--candidate-rank')
const resolverVersion = parseStringFlag(args, '--resolver-version') ??
  SPAN_MOVIE_RESOLVER_VERSION
const db = openDatabase()

try {
  initializeDatabase(db)

  if (!spanId || !candidateRank) {
    throw new Error(
      'Usage: deno task spans:label --span <span-id> --candidate-rank <rank>',
    )
  }

  const candidate = getSpanMovieCandidateByRank(
    db,
    spanId,
    candidateRank,
    resolverVersion,
  )
  if (!candidate) {
    throw new Error(
      `Candidate rank ${candidateRank} not found for span ${spanId}`,
    )
  }

  const now = nowIso()
  upsertSpanMovieLabel(db, {
    id: makeId('label', spanId),
    spanId,
    movieId: candidate.movieId,
    labelSource: 'manual',
    confidence: candidate.confidence,
    createdAt: now,
  })

  console.log(`Span: ${spanId}`)
  console.log(`Label: ${candidate.movieTitle}`)
  console.log(`Source: manual`)
  console.log(`Confidence: ${candidate.confidence.toFixed(4)}`)
  console.log(`Resolver: ${resolverVersion}`)
} catch (error) {
  handleCliError(error)
} finally {
  db.close()
}
