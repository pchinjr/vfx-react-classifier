import {
  getEpisodeById,
  getTranscriptCuesForEpisode,
} from '../../services/storage/episodesRepo.ts'
import { initializeDatabase, openDatabase } from '../../services/storage/db.ts'
import {
  getInferenceWindowsForEpisode,
  replaceInferenceWindowsForEpisode,
  upsertInferenceWindows,
} from '../storage/inferenceWindowsRepo.ts'
import { buildInferenceWindows } from '../services/windows/buildInferenceWindows.ts'
import {
  handleCliError,
  parseBooleanFlag,
  parseNumberFlag,
  parseStringFlag,
} from '../../cli/shared.ts'

const args = [...Deno.args]
const episodeId = parseStringFlag(args, '--episode')
const force = parseBooleanFlag(args, '--force')
const inspect = parseBooleanFlag(args, '--inspect') ||
  parseBooleanFlag(args, '--list')
const windowSizeSeconds = parseNumberFlag(args, '--window-size-seconds') ?? 45
const strideSeconds = parseNumberFlag(args, '--stride-seconds') ?? 15
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
      'Usage: deno task v2:windows --episode <episode-id> [--force] [--inspect]',
    )
  }

  const episode = getEpisodeById(db, episodeId)
  if (!episode) {
    throw new Error(`Episode not found: ${episodeId}`)
  }

  const cues = getTranscriptCuesForEpisode(db, episodeId)
  const windows = buildInferenceWindows(cues, {
    episodeId,
    windowSizeSeconds,
    strideSeconds,
  })

  if (force) {
    replaceInferenceWindowsForEpisode(db, episodeId, windows)
  } else {
    upsertInferenceWindows(db, windows)
  }

  console.log(episode.title)
  console.log(`Episode: ${episodeId}`)
  console.log(`Transcript cues: ${cues.length}`)
  console.log(`Inference windows: ${windows.length}`)
  console.log(`Window size: ${windowSizeSeconds}s`)
  console.log(`Stride: ${strideSeconds}s`)
  console.log(`Mode: ${force ? 'replace' : 'upsert'}`)

  if (inspect) {
    console.log('')
    for (const window of getInferenceWindowsForEpisode(db, episodeId)) {
      console.log(
        `${window.id} | ${formatTimestamp(window.start)}-${
          formatTimestamp(window.end)
        } | ${window.text}`,
      )
    }
  }
} catch (error) {
  handleCliError(error)
} finally {
  db.close()
}
