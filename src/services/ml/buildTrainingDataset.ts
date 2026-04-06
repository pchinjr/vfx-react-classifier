import type {
  CandidateTrainingRow,
  CandidateTrainingSplit,
} from '../../domain/candidateTrainingRow.ts'
import { hashString } from '../../lib/ids.ts'
import type { DatabaseClient } from '../storage/db.ts'
import {
  buildCandidateFeatureVector,
  movieMetadataFromJson,
} from './buildCandidateFeatures.ts'

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
  candidateCount: number
  sameNormalizedTitleCount: number
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

export function buildCandidateTrainingRows(
  db: DatabaseClient,
): CandidateTrainingRow[] {
  const rows = db.queryEntries<CandidateTrainingSourceRow>(
    `
    WITH candidate_context AS (
      SELECT
        smc.id,
        smc.span_id,
        LOWER(mc.title) AS normalized_title,
        COUNT(*) OVER (PARTITION BY smc.span_id) AS candidate_count,
        COUNT(*) OVER (PARTITION BY smc.span_id, LOWER(mc.title))
          AS same_normalized_title_count
      FROM span_movie_candidates smc
      INNER JOIN movie_catalog mc ON mc.id = smc.movie_id
    )
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
      smc.evidence_json AS evidenceJson,
      candidate_context.candidate_count AS candidateCount,
      candidate_context.same_normalized_title_count AS sameNormalizedTitleCount
    FROM span_movie_labels sml
    INNER JOIN discussion_spans ds ON ds.id = sml.span_id
    INNER JOIN span_movie_candidates smc ON smc.span_id = ds.id
    INNER JOIN movie_catalog mc ON mc.id = smc.movie_id
    INNER JOIN candidate_context ON candidate_context.id = smc.id
    WHERE sml.label_source = 'manual'
    ORDER BY ds.episode_id ASC, ds.start ASC, smc.rank ASC
    `,
  )

  return rows.map((row) => {
    const metadata = movieMetadataFromJson(row.metadataJson)
    const featureVector = buildCandidateFeatureVector({
      spanId: row.spanId,
      movieId: row.candidateMovieId,
      spanText: row.spanText,
      movieTitle: row.movieTitle,
      movieOriginalTitle: row.movieOriginalTitle,
      movieOverview: row.movieOverview,
      releaseYear: row.releaseYear,
      popularity: metadata.popularity,
      voteCount: metadata.voteCount,
      rank: row.rank,
      confidence: row.confidence,
      evidenceJson: row.evidenceJson,
      candidateCount: row.candidateCount,
      sameNormalizedTitleCount: row.sameNormalizedTitleCount,
    })

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
      featureJson: JSON.stringify(featureVector),
      split: splitForSpan(row.spanId),
    }
  })
}

export function toJsonl(rows: CandidateTrainingRow[]) {
  return rows.map((row) => JSON.stringify(row)).join('\n') +
    (rows.length ? '\n' : '')
}
