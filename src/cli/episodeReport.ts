import { formatTimestamp } from '../lib/time.ts'
import { initializeDatabase, openDatabase } from '../services/storage/db.ts'
import { countDiscussionSpansForEpisode } from '../services/storage/discussionSpansRepo.ts'
import { getEpisodeById } from '../services/storage/episodesRepo.ts'
import {
  countSpanMovieCandidatesForEpisode,
  countSpanMovieLabelsForEpisode,
  getEpisodeSpanResolutionRows,
  getLatestSpanResolutionRunForEpisode,
} from '../services/storage/spanResolutionRepo.ts'
import { handleCliError, parseStringFlag } from './shared.ts'

const args = [...Deno.args]
const episodeId = parseStringFlag(args, '--episode')
const db = openDatabase()

try {
  initializeDatabase(db)

  if (!episodeId) {
    throw new Error('Usage: deno task episode:report --episode <episode-id>')
  }

  const episode = getEpisodeById(db, episodeId)
  if (!episode) {
    throw new Error(`Episode not found: ${episodeId}`)
  }

  const spanCount = countDiscussionSpansForEpisode(db, episodeId)
  const candidateCount = countSpanMovieCandidatesForEpisode(db, episodeId)
  const labelCount = countSpanMovieLabelsForEpisode(db, episodeId)
  const latestRun = getLatestSpanResolutionRunForEpisode(db, episodeId)
  const rows = getEpisodeSpanResolutionRows(db, episodeId)
  const spansWithCandidates = rows.filter((row) => row.candidateCount > 0)
    .length
  const unresolvedCount = spanCount - labelCount

  console.log(`${episode.title}`)
  console.log(`Episode: ${episode.id}`)
  console.log(`YouTube: ${episode.youtubeVideoId}`)
  console.log(`Source: ${episode.sourceUrl}`)
  console.log('')
  console.log(`Spans: ${spanCount}`)
  console.log(`Spans with candidates: ${spansWithCandidates}`)
  console.log(`Candidates: ${candidateCount}`)
  console.log(`Confirmed labels: ${labelCount}`)
  console.log(`Unlabeled spans: ${unresolvedCount}`)

  if (latestRun) {
    console.log('')
    console.log(`Latest run: ${latestRun.id}`)
    console.log(`Resolver: ${latestRun.resolverVersion}`)
    console.log(`Status: ${latestRun.status}`)
    console.log(`Started: ${latestRun.startedAt}`)
    console.log(`Completed: ${latestRun.completedAt ?? 'not completed'}`)
    if (latestRun.notes) {
      console.log(`Notes: ${latestRun.notes}`)
    }
  }

  if (rows.length) {
    console.log('')
    console.log('Spans')
  }

  for (const row of rows) {
    const timeRange = `${formatTimestamp(row.start)}-${
      formatTimestamp(row.end)
    }`
    const label = row.labelTitle
      ? `label=${row.labelTitle} (${row.labelSource}, ${
        row.labelConfidence?.toFixed(4) ?? '0.0000'
      })`
      : 'label=none'
    const topCandidate = row.topCandidateTitle
      ? `top=${row.topCandidateTitle} (${
        row.topCandidateConfidence?.toFixed(4) ?? '0.0000'
      })`
      : 'top=none'

    console.log(
      `${row.spanId} | ${timeRange} | candidates=${row.candidateCount} | ${label} | ${topCandidate}`,
    )
  }
} catch (error) {
  handleCliError(error)
} finally {
  db.close()
}
