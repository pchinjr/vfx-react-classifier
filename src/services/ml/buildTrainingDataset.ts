import type {
  CandidateTrainingRow,
  CandidateTrainingSplit,
} from '../../domain/candidateTrainingRow.ts'
import { hashString } from '../../lib/ids.ts'
import type { DatabaseClient } from '../storage/db.ts'

type CandidateTrainingSourceRow = {
  spanId: string
  episodeId: string
  candidateMovieId: string
  labelMovieId: string
  resolverVersion: string
  spanText: string
  movieTitle: string
  movieOriginalTitle?: string
  movieOverview?: string
  releaseYear?: number
  metadataJson?: string
  rank: number
  confidence: number
  evidenceJson: string
}

type TmdbMetadata = {
  popularity?: number
  vote_count?: number
}

function metadataFromJson(metadataJson?: string) {
  if (!metadataJson) {
    return {}
  }

  try {
    const parsed = JSON.parse(metadataJson) as TmdbMetadata
    return {
      popularity: typeof parsed.popularity === 'number'
        ? parsed.popularity
        : undefined,
      voteCount: typeof parsed.vote_count === 'number'
        ? parsed.vote_count
        : undefined,
    }
  } catch {
    return {}
  }
}

export function splitForSpan(spanId: string): CandidateTrainingSplit {
  const bucket = Number.parseInt(hashString(spanId).slice(0, 8), 16) % 10
  if (bucket < 8) {
    return 'train'
  }
  if (bucket === 8) {
    return 'validation'
  }
  return 'test'
}

function featureJsonFor(row: CandidateTrainingSourceRow) {
  return JSON.stringify({
    heuristicRank: row.rank,
    heuristicConfidence: row.confidence,
    evidence: JSON.parse(row.evidenceJson),
  })
}

export function buildCandidateTrainingRows(
  db: DatabaseClient,
): CandidateTrainingRow[] {
  const rows = db.queryEntries<CandidateTrainingSourceRow>(
    `
    SELECT
      ds.id AS spanId,
      ds.episode_id AS episodeId,
      smc.movie_id AS candidateMovieId,
      sml.movie_id AS labelMovieId,
      smc.resolver_version AS resolverVersion,
      ds.text AS spanText,
      mc.title AS movieTitle,
      mc.original_title AS movieOriginalTitle,
      mc.overview AS movieOverview,
      mc.release_year AS releaseYear,
      mc.metadata_json AS metadataJson,
      smc.rank,
      smc.confidence,
      smc.evidence_json AS evidenceJson
    FROM span_movie_labels sml
    INNER JOIN discussion_spans ds ON ds.id = sml.span_id
    INNER JOIN span_movie_candidates smc ON smc.span_id = ds.id
    INNER JOIN movie_catalog mc ON mc.id = smc.movie_id
    WHERE sml.label_source = 'manual'
    ORDER BY ds.episode_id ASC, ds.start ASC, smc.rank ASC
    `,
  )

  return rows.map((row) => {
    const metadata = metadataFromJson(row.metadataJson)
    return {
      spanId: row.spanId,
      episodeId: row.episodeId,
      candidateMovieId: row.candidateMovieId,
      label: row.candidateMovieId === row.labelMovieId ? 1 : 0,
      resolverVersion: row.resolverVersion,
      spanText: row.spanText,
      movieTitle: row.movieTitle,
      movieOriginalTitle: row.movieOriginalTitle,
      movieOverview: row.movieOverview,
      releaseYear: row.releaseYear,
      popularity: metadata.popularity,
      voteCount: metadata.voteCount,
      featureJson: featureJsonFor(row),
      split: splitForSpan(row.spanId),
    }
  })
}

export function toJsonl(rows: CandidateTrainingRow[]) {
  return rows.map((row) => JSON.stringify(row)).join('\n') +
    (rows.length ? '\n' : '')
}
