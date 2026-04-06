import type {
  SpanMovieCandidate,
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

  return db.queryEntries<SpanMovieCandidate & { movieTitle: string }>(
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
      mc.title AS movieTitle
    FROM span_movie_candidates smc
    INNER JOIN movie_catalog mc ON mc.id = smc.movie_id
    WHERE smc.span_id = ?
      ${resolverFilter}
    ORDER BY smc.rank ASC, smc.confidence DESC
    `,
    params,
  )
}

export function countSpanMovieCandidatesForEpisode(
  db: DatabaseClient,
  episodeId: string,
) {
  return db.queryEntries<{ count: number }>(
    `
    SELECT COUNT(*) AS count
    FROM span_movie_candidates smc
    INNER JOIN discussion_spans ds ON ds.id = smc.span_id
    WHERE ds.episode_id = ?
    `,
    [episodeId],
  )[0]?.count ?? 0
}
