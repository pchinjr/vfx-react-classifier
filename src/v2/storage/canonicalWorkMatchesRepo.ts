import type { DatabaseClient } from '../../services/storage/db.ts'
import type { CanonicalWorkMatch } from '../domain/canonicalWorkMatch.ts'

export function upsertCanonicalWorkMatches(
  db: DatabaseClient,
  matches: CanonicalWorkMatch[],
) {
  db.execute('BEGIN')

  try {
    for (const match of matches) {
      db.query(
        `
        INSERT INTO v2_canonical_work_matches (
          id, inference_id, work_id, match_confidence, created_at
        )
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          work_id = excluded.work_id,
          match_confidence = excluded.match_confidence,
          created_at = excluded.created_at
        `,
        [
          match.id,
          match.inferenceId,
          match.workId,
          match.matchConfidence,
          match.createdAt,
        ],
      )
    }

    db.execute('COMMIT')
  } catch (error) {
    db.execute('ROLLBACK')
    throw error
  }
}

export function deleteCanonicalWorkMatchesForEpisode(
  db: DatabaseClient,
  episodeId: string,
) {
  db.query(
    `
    DELETE FROM v2_canonical_work_matches
    WHERE inference_id IN (
      SELECT wi.id
      FROM v2_work_inferences wi
      INNER JOIN v2_inference_windows w ON w.id = wi.window_id
      WHERE w.episode_id = ?
    )
    `,
    [episodeId],
  )
}

export function getCanonicalWorkMatchesForEpisode(
  db: DatabaseClient,
  episodeId: string,
) {
  return db.queryEntries<
    CanonicalWorkMatch & {
      titleGuess: string
      canonicalTitle: string
      mediaType: string
      releaseYear?: number
      windowStart: number
      windowEnd: number
    }
  >(
    `
    SELECT
      cwm.id,
      cwm.inference_id AS inferenceId,
      cwm.work_id AS workId,
      cwm.match_confidence AS matchConfidence,
      cwm.created_at AS createdAt,
      wi.title_guess AS titleGuess,
      mc.title AS canonicalTitle,
      mc.media_type AS mediaType,
      mc.release_year AS releaseYear,
      w.start AS windowStart,
      w.end AS windowEnd
    FROM v2_canonical_work_matches cwm
    INNER JOIN v2_work_inferences wi ON wi.id = cwm.inference_id
    INNER JOIN v2_inference_windows w ON w.id = wi.window_id
    INNER JOIN movie_catalog mc ON mc.id = cwm.work_id
    WHERE w.episode_id = ?
    ORDER BY w.start ASC, cwm.match_confidence DESC, mc.title ASC
    `,
    [episodeId],
  )
}
