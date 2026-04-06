import type {
  SpanMovieCandidate,
  SpanMovieLabel,
  SpanResolutionRun,
  SpanResolutionStatus,
} from '../../domain/spanResolution.ts'
import type { DatabaseClient } from './db.ts'

export function createSpanResolutionRun(
  db: DatabaseClient,
  run: SpanResolutionRun,
) {
  db.query(
    `
    INSERT INTO span_resolution_runs (
      id, episode_id, resolver_version, started_at, completed_at, status, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      run.id,
      run.episodeId,
      run.resolverVersion,
      run.startedAt,
      run.completedAt ?? null,
      run.status,
      run.notes ?? null,
    ],
  )
}

export function completeSpanResolutionRun(
  db: DatabaseClient,
  runId: string,
  status: SpanResolutionStatus,
  completedAt: string,
  notes?: string,
) {
  db.query(
    `
    UPDATE span_resolution_runs
    SET status = ?, completed_at = ?, notes = ?
    WHERE id = ?
    `,
    [status, completedAt, notes ?? null, runId],
  )
}

export function upsertSpanMovieCandidates(
  db: DatabaseClient,
  candidates: SpanMovieCandidate[],
) {
  db.execute('BEGIN')

  try {
    for (const candidate of candidates) {
      db.query(
        `
        INSERT INTO span_movie_candidates (
          id, span_id, movie_id, rank, confidence, resolver_version,
          evidence_json, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(span_id, movie_id, resolver_version) DO UPDATE SET
          rank = excluded.rank,
          confidence = excluded.confidence,
          evidence_json = excluded.evidence_json,
          created_at = excluded.created_at
        `,
        [
          candidate.id,
          candidate.spanId,
          candidate.movieId,
          candidate.rank,
          candidate.confidence,
          candidate.resolverVersion,
          candidate.evidenceJson,
          candidate.createdAt,
        ],
      )
    }

    db.execute('COMMIT')
  } catch (error) {
    db.execute('ROLLBACK')
    throw error
  }
}

export function deleteSpanMovieCandidatesForEpisode(
  db: DatabaseClient,
  episodeId: string,
  resolverVersion: string,
) {
  db.query(
    `
    DELETE FROM span_movie_candidates
    WHERE resolver_version = ?
      AND span_id IN (
        SELECT id FROM discussion_spans WHERE episode_id = ?
      )
    `,
    [resolverVersion, episodeId],
  )
}

export function getSpanMovieCandidates(
  db: DatabaseClient,
  spanId: string,
  resolverVersion?: string,
) {
  const params = resolverVersion ? [spanId, resolverVersion] : [spanId]
  const resolverFilter = resolverVersion ? 'AND resolver_version = ?' : ''

  return db.queryEntries<
    SpanMovieCandidate & { movieTitle: string; movieMediaType: string }
  >(
    `
    SELECT
      smc.id,
      smc.span_id AS spanId,
      smc.movie_id AS movieId,
      smc.rank,
      smc.confidence,
      smc.resolver_version AS resolverVersion,
      smc.evidence_json AS evidenceJson,
      smc.created_at AS createdAt,
      mc.title AS movieTitle,
      mc.media_type AS movieMediaType
    FROM span_movie_candidates smc
    INNER JOIN movie_catalog mc ON mc.id = smc.movie_id
    WHERE smc.span_id = ?
      ${resolverFilter}
    ORDER BY smc.rank ASC, smc.confidence DESC
    `,
    params,
  )
}

export function getSpanMovieCandidateByRank(
  db: DatabaseClient,
  spanId: string,
  rank: number,
  resolverVersion?: string,
) {
  const params = resolverVersion
    ? [spanId, rank, resolverVersion]
    : [spanId, rank]
  const resolverFilter = resolverVersion ? 'AND resolver_version = ?' : ''

  return db.queryEntries<
    SpanMovieCandidate & { movieTitle: string; movieMediaType: string }
  >(
    `
    SELECT
      smc.id,
      smc.span_id AS spanId,
      smc.movie_id AS movieId,
      smc.rank,
      smc.confidence,
      smc.resolver_version AS resolverVersion,
      smc.evidence_json AS evidenceJson,
      smc.created_at AS createdAt,
      mc.title AS movieTitle,
      mc.media_type AS movieMediaType
    FROM span_movie_candidates smc
    INNER JOIN movie_catalog mc ON mc.id = smc.movie_id
    WHERE smc.span_id = ?
      AND smc.rank = ?
      ${resolverFilter}
    ORDER BY smc.confidence DESC
    LIMIT 1
    `,
    params,
  )[0] ?? null
}

export function upsertSpanMovieLabel(
  db: DatabaseClient,
  label: SpanMovieLabel,
) {
  db.query(
    `
    INSERT INTO span_movie_labels (
      id, span_id, movie_id, label_source, confidence, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(span_id) DO UPDATE SET
      id = excluded.id,
      movie_id = excluded.movie_id,
      label_source = excluded.label_source,
      confidence = excluded.confidence,
      created_at = excluded.created_at
    `,
    [
      label.id,
      label.spanId,
      label.movieId,
      label.labelSource,
      label.confidence,
      label.createdAt,
    ],
  )
}

export function getSpanMovieLabel(db: DatabaseClient, spanId: string) {
  return db.queryEntries<
    SpanMovieLabel & { movieTitle: string; movieMediaType: string }
  >(
    `
    SELECT
      sml.id,
      sml.span_id AS spanId,
      sml.movie_id AS movieId,
      sml.label_source AS labelSource,
      sml.confidence,
      sml.created_at AS createdAt,
      mc.title AS movieTitle,
      mc.media_type AS movieMediaType
    FROM span_movie_labels sml
    INNER JOIN movie_catalog mc ON mc.id = sml.movie_id
    WHERE sml.span_id = ?
    LIMIT 1
    `,
    [spanId],
  )[0] ?? null
}

export function countSpanMovieCandidatesForEpisode(
  db: DatabaseClient,
  episodeId: string,
  resolverVersion?: string,
) {
  const resolverFilter = resolverVersion ? 'AND smc.resolver_version = ?' : ''
  const params = resolverVersion ? [episodeId, resolverVersion] : [episodeId]

  return db.queryEntries<{ count: number }>(
    `
    SELECT COUNT(*) AS count
    FROM span_movie_candidates smc
    INNER JOIN discussion_spans ds ON ds.id = smc.span_id
    WHERE ds.episode_id = ?
      ${resolverFilter}
    `,
    params,
  )[0]?.count ?? 0
}

export function countSpanMovieLabelsForEpisode(
  db: DatabaseClient,
  episodeId: string,
) {
  return db.queryEntries<{ count: number }>(
    `
    SELECT COUNT(*) AS count
    FROM span_movie_labels sml
    INNER JOIN discussion_spans ds ON ds.id = sml.span_id
    WHERE ds.episode_id = ?
    `,
    [episodeId],
  )[0]?.count ?? 0
}

export function getLatestSpanResolutionRunForEpisode(
  db: DatabaseClient,
  episodeId: string,
) {
  return db.queryEntries<SpanResolutionRun>(
    `
    SELECT
      id,
      episode_id AS episodeId,
      resolver_version AS resolverVersion,
      started_at AS startedAt,
      completed_at AS completedAt,
      status,
      notes
    FROM span_resolution_runs
    WHERE episode_id = ?
    ORDER BY started_at DESC
    LIMIT 1
    `,
    [episodeId],
  )[0] ?? null
}

export function getEpisodeSpanResolutionRows(
  db: DatabaseClient,
  episodeId: string,
  resolverVersion?: string,
) {
  const candidateJoinFilter = resolverVersion
    ? 'AND smc.resolver_version = ?'
    : ''
  const topCandidateJoinFilter = resolverVersion
    ? 'AND top_candidate.resolver_version = ?'
    : ''
  const params = resolverVersion
    ? [resolverVersion, resolverVersion, episodeId]
    : [episodeId]

  return db.queryEntries<{
    spanId: string
    start: number
    end: number
    candidateCount: number
    labelTitle?: string
    labelSource?: string
    labelConfidence?: number
    topCandidateTitle?: string
    topCandidateMediaType?: string
    topCandidateConfidence?: number
  }>(
    `
    SELECT
      ds.id AS spanId,
      ds.start,
      ds.end,
      COUNT(smc.id) AS candidateCount,
      label_movie.title AS labelTitle,
      sml.label_source AS labelSource,
      sml.confidence AS labelConfidence,
      top_movie.title AS topCandidateTitle,
      top_movie.media_type AS topCandidateMediaType,
      top_candidate.confidence AS topCandidateConfidence
    FROM discussion_spans ds
    LEFT JOIN span_movie_candidates smc ON
      smc.span_id = ds.id ${candidateJoinFilter}
    LEFT JOIN span_movie_candidates top_candidate ON
      top_candidate.span_id = ds.id AND top_candidate.rank = 1
      ${topCandidateJoinFilter}
    LEFT JOIN movie_catalog top_movie ON top_movie.id = top_candidate.movie_id
    LEFT JOIN span_movie_labels sml ON sml.span_id = ds.id
    LEFT JOIN movie_catalog label_movie ON label_movie.id = sml.movie_id
    WHERE ds.episode_id = ?
    GROUP BY
      ds.id,
      ds.start,
      ds.end,
      label_movie.title,
      sml.label_source,
      sml.confidence,
      top_movie.title,
      top_movie.media_type,
      top_candidate.confidence
    ORDER BY ds.start ASC
    `,
    params,
  )
}
