import { handleCliError, parseStringFlag } from '../../cli/shared.ts'
import { initializeDatabase, openDatabase } from '../../services/storage/db.ts'
import { getEpisodeById } from '../../services/storage/episodesRepo.ts'
import { evaluateV2ReviewCoverage } from '../services/evaluation/evaluateV2ReviewCoverage.ts'
import { getAggregatedDiscussionsForEpisode } from '../storage/aggregatedDiscussionsRepo.ts'
import { getReviewDecisionsForEpisode } from '../storage/reviewDecisionsRepo.ts'
import { getWorkInferencesForEpisode } from '../storage/workInferencesRepo.ts'

const args = [...Deno.args]
const episodeId = parseStringFlag(args, '--episode')
const db = openDatabase()

try {
  initializeDatabase(db)

  if (!episodeId) {
    throw new Error('Usage: deno task v2:evaluate --episode <episode-id>')
  }

  const episode = getEpisodeById(db, episodeId)
  if (!episode) {
    throw new Error(`Episode not found: ${episodeId}`)
  }

  const inferences = getWorkInferencesForEpisode(db, episodeId)
  const discussions = getAggregatedDiscussionsForEpisode(db, episodeId)
  const decisions = getReviewDecisionsForEpisode(db, episodeId)
  const summary = evaluateV2ReviewCoverage({
    episodeId,
    inferenceIds: inferences.map((inference) => inference.id),
    discussionIds: discussions.map((discussion) => discussion.id),
    decisions,
  })

  console.log(episode.title)
  console.log(`Episode: ${episodeId}`)
  console.log(`Work inferences: ${summary.inferenceCount}`)
  console.log(`Aggregated discussions: ${summary.discussionCount}`)
  console.log(
    `Reviewed inferences: ${summary.reviewedInferenceCount} (${
      (summary.inferenceReviewCoverage * 100).toFixed(1)
    }%)`,
  )
  console.log(
    `Reviewed discussions: ${summary.reviewedDiscussionCount} (${
      (summary.discussionReviewCoverage * 100).toFixed(1)
    }%)`,
  )
  console.log(`Confirmed: ${summary.decisionCounts.confirmed}`)
  console.log(`Corrected: ${summary.decisionCounts.corrected}`)
  console.log(`Rejected: ${summary.decisionCounts.rejected}`)
} catch (error) {
  handleCliError(error)
} finally {
  db.close()
}
