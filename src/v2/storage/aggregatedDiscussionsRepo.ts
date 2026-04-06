import type { DatabaseClient } from '../../services/storage/db.ts'
import type { AggregatedDiscussion } from '../domain/aggregatedDiscussion.ts'

export function replaceAggregatedDiscussionsForEpisode(
  db: DatabaseClient,
  episodeId: string,
  discussions: AggregatedDiscussion[],
) {
  db.execute('BEGIN')

  try {
    db.query('DELETE FROM v2_aggregated_discussions WHERE episode_id = ?', [
      episodeId,
    ])

    for (const discussion of discussions) {
      db.query(
        `
        INSERT INTO v2_aggregated_discussions (
          id, episode_id, work_id, media_type, start, end, role, confidence,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          discussion.id,
          discussion.episodeId,
          discussion.workId,
          discussion.mediaType,
          discussion.start,
          discussion.end,
          discussion.role,
          discussion.confidence,
          discussion.createdAt,
        ],
      )
    }

    db.execute('COMMIT')
  } catch (error) {
    db.execute('ROLLBACK')
    throw error
  }
}

export function getAggregatedDiscussionsForEpisode(
  db: DatabaseClient,
  episodeId: string,
) {
  return db.queryEntries<
    AggregatedDiscussion & {
      canonicalTitle: string
      releaseYear?: number
    }
  >(
    `
    SELECT
      ad.id,
      ad.episode_id AS episodeId,
      ad.work_id AS workId,
      ad.media_type AS mediaType,
      ad.start,
      ad.end,
      ad.role,
      ad.confidence,
      ad.created_at AS createdAt,
      mc.title AS canonicalTitle,
      mc.release_year AS releaseYear
    FROM v2_aggregated_discussions ad
    INNER JOIN movie_catalog mc ON mc.id = ad.work_id
    WHERE ad.episode_id = ?
    ORDER BY ad.start ASC, ad.confidence DESC, mc.title ASC
    `,
    [episodeId],
  )
}
