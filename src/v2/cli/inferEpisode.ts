import { getEnv } from '../../config/env.ts'
import {
  handleCliError,
  parseBooleanFlag,
  parseNumberFlag,
  parseStringFlag,
} from '../../cli/shared.ts'
import { getEpisodeById } from '../../services/storage/episodesRepo.ts'
import { initializeDatabase, openDatabase } from '../../services/storage/db.ts'
import { logger } from '../../lib/logger.ts'
import { inferWorksFromWindow } from '../services/inference/inferWorksFromWindow.ts'
import { V2_WORK_INFERENCE_PROMPT_VERSION } from '../services/inference/promptTemplates.ts'
import { getInferenceWindowsForEpisode } from '../storage/inferenceWindowsRepo.ts'
import {
  deleteWorkInferencesForEpisode,
  getWorkInferencesForEpisode,
  upsertWorkInferences,
} from '../storage/workInferencesRepo.ts'

const args = [...Deno.args]
const episodeId = parseStringFlag(args, '--episode')
const force = parseBooleanFlag(args, '--force')
const inspect = parseBooleanFlag(args, '--inspect') ||
  parseBooleanFlag(args, '--list')
const limit = parseNumberFlag(args, '--limit')
const model = parseStringFlag(args, '--model') ?? getEnv().openAiInferenceModel
const promptVersion = parseStringFlag(args, '--prompt-version') ??
  V2_WORK_INFERENCE_PROMPT_VERSION
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
      'Usage: deno task v2:infer --episode <episode-id> [--force] [--limit N]',
    )
  }

  const episode = getEpisodeById(db, episodeId)
  if (!episode) {
    throw new Error(`Episode not found: ${episodeId}`)
  }

  const windows = getInferenceWindowsForEpisode(db, episodeId)
  if (!windows.length) {
    throw new Error(
      `No V2 inference windows found for ${episodeId}. Run deno task v2:windows --episode ${episodeId} first.`,
    )
  }

  const selectedWindows = typeof limit === 'number'
    ? windows.slice(0, limit)
    : windows

  if (force) {
    deleteWorkInferencesForEpisode(db, episodeId, model, promptVersion)
  }

  let inferenceCount = 0
  for (const [index, window] of selectedWindows.entries()) {
    logger.info('v2.inference.window.start', {
      episodeId,
      windowId: window.id,
      index,
      total: selectedWindows.length,
    })

    const inferences = await inferWorksFromWindow(window, {
      episodeTitle: episode.title,
      model,
      promptVersion,
    })
    upsertWorkInferences(db, inferences)
    inferenceCount += inferences.length

    logger.info('v2.inference.window.complete', {
      episodeId,
      windowId: window.id,
      inferenceCount: inferences.length,
    })
  }

  console.log(episode.title)
  console.log(`Episode: ${episodeId}`)
  console.log(`Model: ${model}`)
  console.log(`Prompt: ${promptVersion}`)
  console.log(`Windows processed: ${selectedWindows.length}/${windows.length}`)
  console.log(`Work inferences written: ${inferenceCount}`)
  console.log(`Mode: ${force ? 'replace' : 'upsert'}`)

  if (inspect) {
    console.log('')
    const inferences = getWorkInferencesForEpisode(db, episodeId, {
      modelVersion: model,
      promptVersion,
    })
    for (const inference of inferences) {
      console.log(
        `${inference.id} | ${formatTimestamp(inference.windowStart)}-${
          formatTimestamp(inference.windowEnd)
        } | ${inference.titleGuess} | ${inference.mediaType} | ${inference.role} | confidence=${
          inference.confidence.toFixed(4)
        }`,
      )
    }
  }
} catch (error) {
  handleCliError(error)
} finally {
  db.close()
}
