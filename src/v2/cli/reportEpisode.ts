import { handleCliError, parseStringFlag } from '../../cli/shared.ts'
import { getEpisodeById } from '../../services/storage/episodesRepo.ts'
import { initializeDatabase, openDatabase } from '../../services/storage/db.ts'
import { getAggregatedDiscussionsForEpisode } from '../storage/aggregatedDiscussionsRepo.ts'
import { getCanonicalWorkMatchesForEpisode } from '../storage/canonicalWorkMatchesRepo.ts'
import { getInferenceWindowsForEpisode } from '../storage/inferenceWindowsRepo.ts'
import { getWorkInferencesForEpisode } from '../storage/workInferencesRepo.ts'

const args = [...Deno.args]
const episodeId = parseStringFlag(args, '--episode')
const db = openDatabase()

function formatTimestamp(value: number) {
  return `${Math.floor(value / 60)}:${
    String(Math.floor(value % 60)).padStart(2, '0')
  }`
}

try {
  initializeDatabase(db)

  if (!episodeId) {
    throw new Error('Usage: deno task v2:report --episode <episode-id>')
  }

  const episode = getEpisodeById(db, episodeId)
  if (!episode) {
    throw new Error(`Episode not found: ${episodeId}`)
  }

  const windows = getInferenceWindowsForEpisode(db, episodeId)
  const inferences = getWorkInferencesForEpisode(db, episodeId)
  const matches = getCanonicalWorkMatchesForEpisode(db, episodeId)
  const discussions = getAggregatedDiscussionsForEpisode(db, episodeId)

  console.log(episode.title)
  console.log(`Episode: ${episodeId}`)
  console.log(`Inference windows: ${windows.length}`)
  console.log(`Work inferences: ${inferences.length}`)
  console.log(`Canonical matches: ${matches.length}`)
  console.log(`Aggregated discussions: ${discussions.length}`)

  if (discussions.length) {
    console.log('')
    console.log('Aggregated discussions')
    for (const discussion of discussions) {
      console.log(
        `${discussion.id} | ${formatTimestamp(discussion.start)}-${
          formatTimestamp(discussion.end)
        } | ${discussion.canonicalTitle}${
          discussion.releaseYear ? ` (${discussion.releaseYear})` : ''
        } | ${discussion.mediaType} | ${discussion.role} | confidence=${
          discussion.confidence.toFixed(4)
        }`,
      )
    }
  }
} catch (error) {
  handleCliError(error)
} finally {
  db.close()
}
