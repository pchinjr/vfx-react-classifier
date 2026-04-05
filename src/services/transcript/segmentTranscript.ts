import type { Segment } from '../../domain/segment.ts'
import type { TranscriptCue } from '../../domain/transcript.ts'
import { ValidationError } from '../../lib/errors.ts'
import { makeId } from '../../lib/ids.ts'
import { nowIso } from '../../lib/time.ts'

export type SegmentTranscriptOptions = {
  episodeId: string
  windowSizeSeconds?: number
  strideSeconds?: number
  createdAt?: string
  maxSegments?: number
}

// Token count is only a rough sizing hint for now; the value is not used for
// billing or hard limits.
function estimateTokens(text: string) {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.3)
}

function collectWindowText(cues: TranscriptCue[], start: number, end: number) {
  return cues
    .filter((cue) => cue.end > start && cue.start < end)
    .map((cue) => cue.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function segmentTranscript(
  cues: TranscriptCue[],
  options: SegmentTranscriptOptions,
): Segment[] {
  const windowSizeSeconds = options.windowSizeSeconds ?? 30
  const strideSeconds = options.strideSeconds ?? 15
  const createdAt = options.createdAt ?? nowIso()
  const maxSegments = options.maxSegments ?? 10000

  if (!Number.isFinite(windowSizeSeconds) || windowSizeSeconds <= 0) {
    throw new ValidationError('windowSizeSeconds must be a positive number')
  }

  if (!Number.isFinite(strideSeconds) || strideSeconds <= 0) {
    throw new ValidationError('strideSeconds must be a positive number')
  }

  if (!Number.isFinite(maxSegments) || maxSegments <= 0) {
    throw new ValidationError('maxSegments must be a positive number')
  }

  if (!cues.length) {
    return []
  }

  const transcriptEnd = Math.max(...cues.map((cue) => cue.end))
  const segments: Segment[] = []

  // The positive stride validation above is what makes this loop practically
  // safe from turning into a non-advancing infinite loop.
  for (let start = 0; start < transcriptEnd; start += strideSeconds) {
    const end = Math.min(start + windowSizeSeconds, transcriptEnd)
    const text = collectWindowText(cues, start, end)

    if (!text) {
      continue
    }

    // Hard-cap segment creation so a malformed transcript or bad options cannot
    // grow the output without bound.
    if (segments.length >= maxSegments) {
      throw new ValidationError(
        `Segment generation exceeded configured maxSegments=${maxSegments}`,
      )
    }

    segments.push({
      id: makeId('seg', options.episodeId, start, end, text),
      episodeId: options.episodeId,
      start,
      end,
      text,
      tokenEstimate: estimateTokens(text),
      createdAt,
    })

    if (end === transcriptEnd) {
      break
    }
  }

  return segments
}
