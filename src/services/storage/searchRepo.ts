import type { SearchResult } from '../../domain/search.ts'
import type { SegmentEmbedding } from '../../domain/embedding.ts'
import type { DatabaseClient } from './db.ts'

export type SegmentWithEmbedding = {
  segmentId: string
  episodeId: string
  episodeTitle: string
  start: number
  end: number
  text: string
  embedding: number[]
  model: string
  dimensions: number
}

// Embeddings are currently stored as JSON strings in SQLite, so search loading
// deserializes them into numeric arrays before ranking.
export function getSegmentsWithEmbeddings(
  db: DatabaseClient,
  model: string,
): SegmentWithEmbedding[] {
  const rows = db.queryEntries<
    SearchResult & SegmentEmbedding & { embedding_json: string }
  >(
    `
    SELECT
      s.id AS segmentId,
      s.episode_id AS episodeId,
      e.title AS episodeTitle,
      s.start,
      s.end,
      s.text,
      se.model,
      se.dimensions,
      se.embedding_json
    FROM segments s
    INNER JOIN episodes e ON e.id = s.episode_id
    INNER JOIN segment_embeddings se
      ON se.segment_id = s.id
    WHERE se.model = ?
    `,
    [model],
  )

  return rows.map((row) => ({
    segmentId: row.segmentId,
    episodeId: row.episodeId,
    episodeTitle: row.episodeTitle,
    start: row.start,
    end: row.end,
    text: row.text,
    embedding: JSON.parse(row.embedding_json) as number[],
    model: row.model,
    dimensions: row.dimensions,
  }))
}

export function searchCandidateSegments(
  db: DatabaseClient,
  model: string,
) {
  return getSegmentsWithEmbeddings(db, model)
}
