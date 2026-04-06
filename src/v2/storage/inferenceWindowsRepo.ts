import type { DatabaseClient } from '../../services/storage/db.ts'
import type { InferenceWindow } from '../domain/inferenceWindow.ts'

export function upsertInferenceWindows(
  db: DatabaseClient,
  windows: InferenceWindow[],
) {
  db.execute('BEGIN')

  try {
    for (const window of windows) {
      db.query(
        `
        INSERT INTO v2_inference_windows (
          id, episode_id, start, end, text, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          start = excluded.start,
          end = excluded.end,
          text = excluded.text,
          created_at = excluded.created_at
        `,
        [
          window.id,
          window.episodeId,
          window.start,
          window.end,
          window.text,
          window.createdAt,
        ],
      )
    }

    db.execute('COMMIT')
  } catch (error) {
    db.execute('ROLLBACK')
    throw error
  }
}

export function replaceInferenceWindowsForEpisode(
  db: DatabaseClient,
  episodeId: string,
  windows: InferenceWindow[],
) {
  db.execute('BEGIN')

  try {
    db.query('DELETE FROM v2_inference_windows WHERE episode_id = ?', [
      episodeId,
    ])

    for (const window of windows) {
      db.query(
        `
        INSERT INTO v2_inference_windows (
          id, episode_id, start, end, text, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          window.id,
          window.episodeId,
          window.start,
          window.end,
          window.text,
          window.createdAt,
        ],
      )
    }

    db.execute('COMMIT')
  } catch (error) {
    db.execute('ROLLBACK')
    throw error
  }
}

export function getInferenceWindowsForEpisode(
  db: DatabaseClient,
  episodeId: string,
) {
  return db.queryEntries<InferenceWindow>(
    `
    SELECT
      id,
      episode_id AS episodeId,
      start,
      end,
      text,
      created_at AS createdAt
    FROM v2_inference_windows
    WHERE episode_id = ?
    ORDER BY start ASC
    `,
    [episodeId],
  )
}

export function countInferenceWindowsForEpisode(
  db: DatabaseClient,
  episodeId: string,
) {
  return db.queryEntries<{ count: number }>(
    `
    SELECT COUNT(*) AS count
    FROM v2_inference_windows
    WHERE episode_id = ?
    `,
    [episodeId],
  )[0]?.count ?? 0
}
