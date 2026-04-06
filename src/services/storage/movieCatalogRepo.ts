import type { MovieCatalogRecord } from '../../domain/movieCatalog.ts'
import type { DatabaseClient } from './db.ts'

export function upsertMovieCatalogRecords(
  db: DatabaseClient,
  records: MovieCatalogRecord[],
) {
  db.execute('BEGIN')

  try {
    for (const record of records) {
      db.query(
        `
        INSERT INTO movie_catalog (
          id, source, source_movie_id, media_type, title, original_title,
          release_date, release_year, overview, metadata_json, created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(source, media_type, source_movie_id) DO UPDATE SET
          title = excluded.title,
          original_title = excluded.original_title,
          release_date = excluded.release_date,
          release_year = excluded.release_year,
          overview = excluded.overview,
          metadata_json = excluded.metadata_json,
          updated_at = excluded.updated_at
        `,
        [
          record.id,
          record.source,
          record.sourceMovieId,
          record.mediaType,
          record.title,
          record.originalTitle ?? null,
          record.releaseDate ?? null,
          record.releaseYear ?? null,
          record.overview ?? null,
          record.metadataJson ?? null,
          record.createdAt,
          record.updatedAt,
        ],
      )
    }

    db.execute('COMMIT')
  } catch (error) {
    db.execute('ROLLBACK')
    throw error
  }
}

export function getMovieCatalogRecord(
  db: DatabaseClient,
  source: MovieCatalogRecord['source'],
  sourceMovieId: string,
  mediaType: MovieCatalogRecord['mediaType'] = 'movie',
) {
  const rows = db.queryEntries<MovieCatalogRecord>(
    `
    SELECT
      id,
      source,
      source_movie_id AS sourceMovieId,
      media_type AS mediaType,
      title,
      original_title AS originalTitle,
      release_date AS releaseDate,
      release_year AS releaseYear,
      overview,
      metadata_json AS metadataJson,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM movie_catalog
    WHERE source = ? AND source_movie_id = ? AND media_type = ?
    LIMIT 1
    `,
    [source, sourceMovieId, mediaType],
  )

  return rows[0] ?? null
}

export function searchCachedMovieCatalogRecords(
  db: DatabaseClient,
  query: string,
  limit = 10,
) {
  const likeQuery = `%${query}%`
  return db.queryEntries<MovieCatalogRecord>(
    `
    SELECT
      id,
      source,
      source_movie_id AS sourceMovieId,
      media_type AS mediaType,
      title,
      original_title AS originalTitle,
      release_date AS releaseDate,
      release_year AS releaseYear,
      overview,
      metadata_json AS metadataJson,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM movie_catalog
    WHERE title LIKE ? OR original_title LIKE ?
    ORDER BY release_year ASC, title ASC
    LIMIT ?
    `,
    [likeQuery, likeQuery, limit],
  )
}
