import type { DiscussionSpan } from '../../domain/discussionSpan.ts'
import type { DatabaseClient } from './db.ts'

export function upsertDiscussionSpans(
  db: DatabaseClient,
  spans: DiscussionSpan[],
) {
  db.execute('BEGIN')

  try {
    for (const span of spans) {
      db.query(
        `
        INSERT INTO discussion_spans (
          id, episode_id, start, end, text, source_segment_count, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          start = excluded.start,
          end = excluded.end,
          text = excluded.text,
          source_segment_count = excluded.source_segment_count,
          created_at = excluded.created_at
        `,
        [
          span.id,
          span.episodeId,
          span.start,
          span.end,
          span.text,
          span.sourceSegmentCount,
          span.createdAt,
        ],
      )
    }

    db.execute('COMMIT')
  } catch (error) {
    db.execute('ROLLBACK')
    throw error
  }
}

// Force rebuilds replace spans derived for an episode so stale span boundaries
// disappear after segmentation settings change.
export function replaceDiscussionSpansForEpisode(
  db: DatabaseClient,
  episodeId: string,
  spans: DiscussionSpan[],
) {
  db.execute('BEGIN')

  try {
    db.query('DELETE FROM discussion_spans WHERE episode_id = ?', [episodeId])

    for (const span of spans) {
      db.query(
        `
        INSERT INTO discussion_spans (
          id, episode_id, start, end, text, source_segment_count, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          span.id,
          span.episodeId,
          span.start,
          span.end,
          span.text,
          span.sourceSegmentCount,
          span.createdAt,
        ],
      )
    }

    db.execute('COMMIT')
  } catch (error) {
    db.execute('ROLLBACK')
    throw error
  }
}

export function getDiscussionSpansForEpisode(
  db: DatabaseClient,
  episodeId: string,
) {
  return db.queryEntries<DiscussionSpan>(
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
    WHERE episode_id = ?
    ORDER BY start ASC
    `,
    [episodeId],
  )
}

export function countDiscussionSpansForEpisode(
  db: DatabaseClient,
  episodeId: string,
) {
  return db.queryEntries<{ count: number }>(
    `
    SELECT COUNT(*) AS count
    FROM discussion_spans
    WHERE episode_id = ?
    `,
    [episodeId],
  )[0]?.count ?? 0
}
