import { getEnv } from '../../config/env.ts'
import {
  handleCliError,
  parseBooleanFlag,
  parseStringFlag,
} from '../../cli/shared.ts'
import { getEpisodeById } from '../../services/storage/episodesRepo.ts'
import { initializeDatabase, openDatabase } from '../../services/storage/db.ts'
import { upsertMovieCatalogRecords } from '../../services/storage/movieCatalogRepo.ts'
import { searchTmdbWorks } from '../../services/movies/tmdbClient.ts'
import { canonicalizeInference } from '../services/canonicalization/canonicalizeInference.ts'
import {
  deleteCanonicalWorkMatchesForEpisode,
  getCanonicalWorkMatchesForEpisode,
  upsertCanonicalWorkMatches,
} from '../storage/canonicalWorkMatchesRepo.ts'
import { getWorkInferencesForEpisode } from '../storage/workInferencesRepo.ts'

const args = [...Deno.args]
const episodeId = parseStringFlag(args, '--episode')
const force = parseBooleanFlag(args, '--force')
const inspect = parseBooleanFlag(args, '--inspect') ||
  parseBooleanFlag(args, '--list')
const db = openDatabase()

function formatTimestamp(value: number) {
  return `${Math.floor(value / 60)}:${
    String(Math.floor(value % 60)).padStart(2, '0')
  }`
}

try {
  initializeDatabase(db)

  if (!episodeId) {
    throw new Error(
      'Usage: deno task v2:canonicalize --episode <episode-id> [--force]',
    )
  }

  const episode = getEpisodeById(db, episodeId)
  if (!episode) {
    throw new Error(`Episode not found: ${episodeId}`)
  }

  const inferences = getWorkInferencesForEpisode(db, episodeId)
  if (!inferences.length) {
    throw new Error(
      `No V2 work inferences found for ${episodeId}. Run deno task v2:infer --episode ${episodeId} first.`,
    )
  }

  if (force) {
    deleteCanonicalWorkMatchesForEpisode(db, episodeId)
  }

  let workCount = 0
  let matchCount = 0
  for (const inference of inferences) {
    const result = await canonicalizeInference(inference, {
      searchWorks: (query, mediaTypeHint) =>
        searchTmdbWorks(query, {
          apiKey: getEnv().tmdbApiKey,
          mediaTypeHint,
          queryQualityTier: 'high',
          limit: 5,
        }),
    })

    upsertMovieCatalogRecords(db, result.works)
    workCount += result.works.length
    if (result.match) {
      upsertCanonicalWorkMatches(db, [result.match])
      matchCount += 1
    }
  }

  console.log(episode.title)
  console.log(`Episode: ${episodeId}`)
  console.log(`Inferences: ${inferences.length}`)
  console.log(`Catalog works returned: ${workCount}`)
  console.log(`Canonical matches written: ${matchCount}`)
  console.log(`Mode: ${force ? 'replace' : 'upsert'}`)

  if (inspect) {
    console.log('')
    for (const match of getCanonicalWorkMatchesForEpisode(db, episodeId)) {
      console.log(
        `${match.id} | ${formatTimestamp(match.windowStart)}-${
          formatTimestamp(match.windowEnd)
        } | ${match.titleGuess} -> ${match.canonicalTitle}${
          match.releaseYear ? ` (${match.releaseYear})` : ''
        } | ${match.mediaType} | confidence=${
          match.matchConfidence.toFixed(4)
        }`,
      )
    }
  }
} catch (error) {
  handleCliError(error)
} finally {
  db.close()
}
