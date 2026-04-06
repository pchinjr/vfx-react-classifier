import type { TranscriptCue } from '../../../domain/transcript.ts'
import { ValidationError } from '../../../lib/errors.ts'
import { makeId } from '../../../lib/ids.ts'
import { nowIso } from '../../../lib/time.ts'
import type { InferenceWindow } from '../../domain/inferenceWindow.ts'

export type BuildInferenceWindowsOptions = {
  episodeId: string
  windowSizeSeconds?: number
  strideSeconds?: number
  createdAt?: string
  maxWindows?: number
}

const DEFAULT_WINDOW_SIZE_SECONDS = 45
const DEFAULT_STRIDE_SECONDS = 15
const DEFAULT_MAX_WINDOWS = 10000

function collectWindowText(cues: TranscriptCue[], start: number, end: number) {
  return cues
    .filter((cue) => cue.end > start && cue.start < end)
    .map((cue) => cue.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function boundaryKey(value: number) {
  return value.toFixed(3)
}

function makeWindowId(
  episodeId: string,
  start: number,
  end: number,
  text: string,
) {
  return makeId(
    'v2win',
    episodeId,
    boundaryKey(start),
    boundaryKey(end),
    text,
  )
}

export function buildInferenceWindows(
  cues: TranscriptCue[],
  options: BuildInferenceWindowsOptions,
): InferenceWindow[] {
  const windowSizeSeconds = options.windowSizeSeconds ??
    DEFAULT_WINDOW_SIZE_SECONDS
  const strideSeconds = options.strideSeconds ?? DEFAULT_STRIDE_SECONDS
  const maxWindows = options.maxWindows ?? DEFAULT_MAX_WINDOWS
  const createdAt = options.createdAt ?? nowIso()

  if (!Number.isFinite(windowSizeSeconds) || windowSizeSeconds <= 0) {
    throw new ValidationError('windowSizeSeconds must be a positive number')
  }

  if (!Number.isFinite(strideSeconds) || strideSeconds <= 0) {
    throw new ValidationError('strideSeconds must be a positive number')
  }

  if (!Number.isFinite(maxWindows) || maxWindows <= 0) {
    throw new ValidationError('maxWindows must be a positive number')
  }

  if (!cues.length) {
    return []
  }

  const transcriptEnd = Math.max(...cues.map((cue) => cue.end))
  const windows: InferenceWindow[] = []

  for (let start = 0; start < transcriptEnd; start += strideSeconds) {
    const end = Math.min(start + windowSizeSeconds, transcriptEnd)
    const text = collectWindowText(cues, start, end)

    if (!text) {
      if (end === transcriptEnd) {
        break
      }
      continue
    }

    if (windows.length >= maxWindows) {
      throw new ValidationError(
        `Inference window generation exceeded configured maxWindows=${maxWindows}`,
      )
    }

    windows.push({
      id: makeWindowId(options.episodeId, start, end, text),
      episodeId: options.episodeId,
      start,
      end,
      text,
      createdAt,
    })

    if (end === transcriptEnd) {
      break
    }
  }

  return windows
}
