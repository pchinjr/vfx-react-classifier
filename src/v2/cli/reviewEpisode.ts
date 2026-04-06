import { handleCliError, parseStringFlag } from '../../cli/shared.ts'
import { makeId } from '../../lib/ids.ts'
import { nowIso } from '../../lib/time.ts'
import { initializeDatabase, openDatabase } from '../../services/storage/db.ts'
import { getEpisodeById } from '../../services/storage/episodesRepo.ts'
import { getAggregatedDiscussionsForEpisode } from '../storage/aggregatedDiscussionsRepo.ts'
import { getWorkInferencesForEpisode } from '../storage/workInferencesRepo.ts'
import {
  isReviewDecisionValue,
  isReviewTargetType,
} from '../domain/reviewDecision.ts'
import {
  getReviewDecisionForTarget,
  getReviewDecisionsForEpisode,
  upsertReviewDecision,
} from '../storage/reviewDecisionsRepo.ts'

const args = [...Deno.args]
const episodeId = parseStringFlag(args, '--episode')
const targetType = parseStringFlag(args, '--target-type')
const targetId = parseStringFlag(args, '--target-id')
const decision = parseStringFlag(args, '--decision')
const workId = parseStringFlag(args, '--work-id') ?? undefined
const notes = parseStringFlag(args, '--notes') ?? undefined
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
      'Usage: deno task v2:review --episode <episode-id> [--target-type inference|discussion --target-id <id> --decision confirmed|corrected|rejected]',
    )
  }

  const episode = getEpisodeById(db, episodeId)
  if (!episode) {
    throw new Error(`Episode not found: ${episodeId}`)
  }

  if (targetType || targetId || decision) {
    if (!targetType || !isReviewTargetType(targetType)) {
      throw new Error('Expected --target-type inference|discussion')
    }
    if (!targetId) {
      throw new Error('Expected --target-id <id>')
    }
    if (!decision || !isReviewDecisionValue(decision)) {
      throw new Error('Expected --decision confirmed|corrected|rejected')
    }
    if (decision === 'corrected' && !workId) {
      throw new Error('Corrected review decisions require --work-id <work-id>')
    }

    upsertReviewDecision(db, {
      id: makeId('v2review', targetType, targetId),
      targetType,
      targetId,
      decision,
      workId,
      notes,
      createdAt: nowIso(),
    })
  }

  const decisions = getReviewDecisionsForEpisode(db, episodeId)
  const inferences = getWorkInferencesForEpisode(db, episodeId)
  const discussions = getAggregatedDiscussionsForEpisode(db, episodeId)

  console.log(episode.title)
  console.log(`Episode: ${episodeId}`)
  console.log(`Review decisions: ${decisions.length}`)

  if (discussions.length) {
    console.log('')
    console.log('Aggregated discussions')
    for (const discussion of discussions) {
      const review = getReviewDecisionForTarget(
        db,
        'discussion',
        discussion.id,
      )
      console.log(
        `${discussion.id} | ${formatTimestamp(discussion.start)}-${
          formatTimestamp(discussion.end)
        } | ${discussion.canonicalTitle}${
          discussion.releaseYear ? ` (${discussion.releaseYear})` : ''
        } | ${discussion.role} | confidence=${
          discussion.confidence.toFixed(4)
        } | review=${review?.decision ?? 'pending'}`,
      )
    }
  }

  if (inferences.length) {
    console.log('')
    console.log('Raw inferences')
    for (const inference of inferences) {
      const review = getReviewDecisionForTarget(db, 'inference', inference.id)
      console.log(
        `${inference.id} | ${formatTimestamp(inference.windowStart)}-${
          formatTimestamp(inference.windowEnd)
        } | ${inference.titleGuess} | ${inference.mediaType} | ${inference.role} | confidence=${
          inference.confidence.toFixed(4)
        } | review=${review?.decision ?? 'pending'}`,
      )
    }
  }
} catch (error) {
  handleCliError(error)
} finally {
  db.close()
}
