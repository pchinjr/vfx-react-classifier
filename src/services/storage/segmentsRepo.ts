import type { SegmentEmbedding } from '../../domain/embedding.ts'
import type { Segment } from '../../domain/segment.ts'
import type { DatabaseClient } from './db.ts'

export function replaceSegmentsForEpisode(
  db: DatabaseClient,
  episodeId: string,
  segments: Segment[],
) {
  db.execute('BEGIN')

  try {
    db.query('DELETE FROM segments WHERE episode_id = ?', [episodeId])

    for (const segment of segments) {
      db.query(
        `
        INSERT INTO segments (
          id, episode_id, start, end, text, token_estimate, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          segment.id,
          segment.episodeId,
          segment.start,
          segment.end,
          segment.text,
          segment.tokenEstimate ?? null,
          segment.createdAt,
        ],
      )
    }

    db.execute('COMMIT')
  } catch (error) {
    db.execute('ROLLBACK')
    throw error
  }
}

export function upsertSegmentEmbeddings(
  db: DatabaseClient,
  embeddings: SegmentEmbedding[],
) {
  db.execute('BEGIN')

  try {
    for (const embedding of embeddings) {
      db.query(
        `
        INSERT INTO segment_embeddings (
          segment_id, model, dimensions, embedding_json, created_at
        )
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(segment_id, model) DO UPDATE SET
          dimensions = excluded.dimensions,
          embedding_json = excluded.embedding_json,
          created_at = excluded.created_at
        `,
        [
          embedding.segmentId,
          embedding.model,
          embedding.dimensions,
          JSON.stringify(embedding.embedding),
          embedding.createdAt,
        ],
      )
    }

    db.execute('COMMIT')
  } catch (error) {
    db.execute('ROLLBACK')
    throw error
  }
}

export function getSegmentsMissingEmbeddings(
  db: DatabaseClient,
  model: string,
  episodeId?: string,
) {
  const params: Array<string> = [model]
  const episodeFilter = episodeId
    ? 'WHERE s.episode_id = ? AND se.segment_id IS NULL'
    : 'WHERE se.segment_id IS NULL'

  if (episodeId) {
    params.push(episodeId)
  }

  return db.queryEntries<Segment>(
    `
    SELECT
      s.id,
      s.episode_id AS episodeId,
      s.start,
      s.end,
      s.text,
      s.token_estimate AS tokenEstimate,
      s.created_at AS createdAt
    FROM segments s
    LEFT JOIN segment_embeddings se
      ON se.segment_id = s.id AND se.model = ?
    ${episodeFilter}
    ORDER BY s.start ASC
    `,
    params,
  )
}

export function getSegmentsForEpisode(
  db: DatabaseClient,
  episodeId: string,
) {
  return db.queryEntries<Segment>(
    `
    SELECT
      id,
      episode_id AS episodeId,
      start,
      end,
      text,
      token_estimate AS tokenEstimate,
      created_at AS createdAt
    FROM segments
    WHERE episode_id = ?
    ORDER BY start ASC
    `,
    [episodeId],
  )
}

export function getAllSegments(db: DatabaseClient) {
  return db.queryEntries<Segment>(
    `
    SELECT
      id,
      episode_id AS episodeId,
      start,
      end,
      text,
      token_estimate AS tokenEstimate,
      created_at AS createdAt
    FROM segments
    ORDER BY episode_id ASC, start ASC
    `,
  )
}
