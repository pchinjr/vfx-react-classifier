import {
  handleCliError,
  parseNumberFlag,
  parseStringFlag,
} from '../../cli/shared.ts'
import { getEpisodeById } from '../../services/storage/episodesRepo.ts'
import { initializeDatabase, openDatabase } from '../../services/storage/db.ts'
import { aggregateWorkInferences } from '../services/aggregation/aggregateWorkInferences.ts'
import {
  getAggregatedDiscussionsForEpisode,
  replaceAggregatedDiscussionsForEpisode,
} from '../storage/aggregatedDiscussionsRepo.ts'
import { getCanonicalWorkMatchesForEpisode } from '../storage/canonicalWorkMatchesRepo.ts'

const args = [...Deno.args]
const episodeId = parseStringFlag(args, '--episode')
const maxGapSeconds = parseNumberFlag(args, '--max-gap-seconds') ?? 30
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
      'Usage: deno task v2:aggregate --episode <episode-id>',
    )
  }

  const episode = getEpisodeById(db, episodeId)
  if (!episode) {
    throw new Error(`Episode not found: ${episodeId}`)
  }

  const matches = getCanonicalWorkMatchesForEpisode(db, episodeId)
  const discussions = aggregateWorkInferences(
    matches.map((match) => ({
      workId: match.workId,
      mediaType: match.mediaType === 'tv' ? 'tv' : 'movie',
      role: match.role === 'primary' ? 'primary' : 'secondary',
      windowStart: match.windowStart,
      windowEnd: match.windowEnd,
      confidence: match.matchConfidence,
    })),
    { episodeId, maxGapSeconds },
  )
  replaceAggregatedDiscussionsForEpisode(db, episodeId, discussions)

  console.log(episode.title)
  console.log(`Episode: ${episodeId}`)
  console.log(`Canonical matches: ${matches.length}`)
  console.log(`Aggregated discussions: ${discussions.length}`)
  console.log(`Max gap: ${maxGapSeconds}s`)

  console.log('')
  for (const discussion of getAggregatedDiscussionsForEpisode(db, episodeId)) {
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
} catch (error) {
  handleCliError(error)
} finally {
  db.close()
}
