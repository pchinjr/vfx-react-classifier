import type { DatabaseClient } from '../../services/storage/db.ts'
import type { ReviewDecision } from '../domain/reviewDecision.ts'

export function upsertReviewDecision(
  db: DatabaseClient,
  decision: ReviewDecision,
) {
  db.query(
    `
    INSERT INTO v2_review_decisions (
      id, target_type, target_id, decision, work_id, notes, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      target_type = excluded.target_type,
      target_id = excluded.target_id,
      decision = excluded.decision,
      work_id = excluded.work_id,
      notes = excluded.notes,
      created_at = excluded.created_at
    `,
    [
      decision.id,
      decision.targetType,
      decision.targetId,
      decision.decision,
      decision.workId ?? null,
      decision.notes ?? null,
      decision.createdAt,
    ],
  )
}

export function getReviewDecisionForTarget(
  db: DatabaseClient,
  targetType: string,
  targetId: string,
) {
  return db.queryEntries<ReviewDecision>(
    `
    SELECT
      id,
      target_type AS targetType,
      target_id AS targetId,
      decision,
      work_id AS workId,
      notes,
      created_at AS createdAt
    FROM v2_review_decisions
    WHERE target_type = ? AND target_id = ?
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [targetType, targetId],
  )[0] ?? null
}

export function getReviewDecisionsForEpisode(
  db: DatabaseClient,
  episodeId: string,
) {
  return db.queryEntries<ReviewDecision>(
    `
    SELECT
      rd.id,
      rd.target_type AS targetType,
      rd.target_id AS targetId,
      rd.decision,
      rd.work_id AS workId,
      rd.notes,
      rd.created_at AS createdAt
    FROM v2_review_decisions rd
    WHERE (
      rd.target_type = 'inference'
      AND rd.target_id IN (
        SELECT wi.id
        FROM v2_work_inferences wi
        INNER JOIN v2_inference_windows w ON w.id = wi.window_id
        WHERE w.episode_id = ?
      )
    )
    OR (
      rd.target_type = 'discussion'
      AND rd.target_id IN (
        SELECT id
        FROM v2_aggregated_discussions
        WHERE episode_id = ?
      )
    )
    ORDER BY rd.created_at ASC, rd.id ASC
    `,
    [episodeId, episodeId],
  )
}
