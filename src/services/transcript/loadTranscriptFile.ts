import { extname } from '@std/path'

import { getEnv } from '../../config/env.ts'
import type { TranscriptCue } from '../../domain/transcript.ts'
import { ValidationError } from '../../lib/errors.ts'
import { parseJson3, parseVtt } from '../youtube/fetchCaptions.ts'

type TranscriptCueLike = {
  start?: number
  end?: number
  text?: string
}

function isTranscriptCueArray(value: unknown): value is TranscriptCueLike[] {
  return Array.isArray(value)
}

function parseCueJson(content: string): TranscriptCue[] {
  const parsed = JSON.parse(content) as unknown
  if (!isTranscriptCueArray(parsed)) {
    throw new ValidationError(
      'Transcript JSON must be either a JSON3 transcript or an array of cues',
    )
  }

  return parsed.map((item, index) => {
    if (
      typeof item.start !== 'number' ||
      typeof item.end !== 'number' ||
      typeof item.text !== 'string'
    ) {
      throw new ValidationError(
        `Transcript cue at index ${index} is missing numeric start/end or string text`,
      )
    }

    return {
      start: item.start,
      end: item.end,
      text: item.text,
    }
  })
}

function enforceCueLimit(cues: TranscriptCue[]) {
  const { maxTranscriptCues } = getEnv()
  if (cues.length > maxTranscriptCues) {
    throw new ValidationError(
      `Transcript cue count ${cues.length} exceeded maxTranscriptCues=${maxTranscriptCues}`,
    )
  }

  return cues
}

// Manual transcript loading is the fallback when YouTube caption fetch is
// unavailable. VTT, JSON3, and JSON cue arrays are supported.
export async function loadTranscriptFile(
  path: string,
): Promise<TranscriptCue[]> {
  const content = await Deno.readTextFile(path)
  const extension = extname(path).toLowerCase()

  if (extension === '.vtt') {
    return enforceCueLimit(parseVtt(content))
  }

  if (extension === '.json3') {
    return enforceCueLimit(parseJson3(content))
  }

  if (extension === '.json') {
    try {
      return enforceCueLimit(parseCueJson(content))
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }

      return enforceCueLimit(parseJson3(content))
    }
  }

  throw new ValidationError(
    `Unsupported transcript file extension: ${extension || '(none)'}`,
  )
}
