import { assertEquals } from '@std/assert'

import type { MovieCatalogRecord } from '../domain/movieCatalog.ts'
import {
  getMovieCatalogRecord,
  searchCachedMovieCatalogRecords,
  upsertMovieCatalogRecords,
} from '../services/storage/movieCatalogRepo.ts'
import { createTestDatabase } from '../services/storage/testDb.ts'

function movie(
  overrides: Partial<MovieCatalogRecord> = {},
): MovieCatalogRecord {
  return {
    id: 'movie_one',
    source: 'tmdb',
    sourceMovieId: '329',
    mediaType: 'movie',
    title: 'Jurassic Park',
    originalTitle: 'Jurassic Park',
    releaseDate: '1993-06-11',
    releaseYear: 1993,
    overview: 'Dinosaurs escape.',
    metadataJson: '{}',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

Deno.test('upsertMovieCatalogRecords updates cached records without duplicates', () => {
  const { db } = createTestDatabase('movie-catalog-repo-upsert')

  try {
    upsertMovieCatalogRecords(db, [movie()])
    upsertMovieCatalogRecords(db, [
      movie({
        title: 'Jurassic Park Updated',
        overview: 'Updated overview.',
        updatedAt: '2026-01-02T00:00:00.000Z',
      }),
    ])

    const record = getMovieCatalogRecord(db, 'tmdb', '329')
    assertEquals(record?.title, 'Jurassic Park Updated')
    assertEquals(record?.overview, 'Updated overview.')
    assertEquals(
      db.queryEntries<{ count: number }>(
        'SELECT COUNT(*) AS count FROM movie_catalog',
      )[0]?.count,
      1,
    )
  } finally {
    db.close()
  }
})

Deno.test('searchCachedMovieCatalogRecords finds cached titles', () => {
  const { db } = createTestDatabase('movie-catalog-repo-search')

  try {
    upsertMovieCatalogRecords(db, [
      movie(),
      movie({
        id: 'movie_two',
        sourceMovieId: '671',
        title: "Harry Potter and the Philosopher's Stone",
        originalTitle: "Harry Potter and the Philosopher's Stone",
        releaseDate: '2001-11-16',
        releaseYear: 2001,
      }),
    ])

    const records = searchCachedMovieCatalogRecords(db, 'Harry Potter')
    assertEquals(records.map((record) => record.sourceMovieId), ['671'])
  } finally {
    db.close()
  }
})
