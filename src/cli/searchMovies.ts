import { getEnv } from '../config/env.ts'
import type { MovieCatalogRecord } from '../domain/movieCatalog.ts'
import { initializeDatabase, openDatabase } from '../services/storage/db.ts'
import { upsertMovieCatalogRecords } from '../services/storage/movieCatalogRepo.ts'
import { searchTmdbMovies } from '../services/movies/tmdbClient.ts'
import { handleCliError, parseNumberFlag } from './shared.ts'

function printMovies(records: MovieCatalogRecord[]) {
  if (!records.length) {
    console.log('No movie candidates found.')
    return
  }

  for (const [index, record] of records.entries()) {
    const year = record.releaseYear ? ` (${record.releaseYear})` : ''
    console.log(
      `${
        index + 1
      }. ${record.title}${year} | ${record.source}:${record.sourceMovieId} | ${record.id}`,
    )
    if (record.overview) {
      console.log(record.overview)
    }
    console.log('')
  }
}

const args = [...Deno.args]
const limit = parseNumberFlag(args, '--limit') ?? 5
const query = args.filter((arg, index) =>
  !arg.startsWith('--') && args[index - 1] !== '--limit'
).join(' ').trim()
const db = openDatabase()

try {
  initializeDatabase(db)

  if (!query) {
    throw new Error('Usage: deno task movies:search <query> [--limit 5]')
  }

  const records = await searchTmdbMovies(query, {
    apiKey: getEnv().tmdbApiKey,
    limit,
  })
  upsertMovieCatalogRecords(db, records)
  printMovies(records)
} catch (error) {
  handleCliError(error)
} finally {
  db.close()
}
