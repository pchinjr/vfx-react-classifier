import type { Segment } from '../../domain/segment.ts'
import type { TranscriptCue } from '../../domain/transcript.ts'
import { makeId } from '../../lib/ids.ts'
import { nowIso } from '../../lib/time.ts'

export type SegmentTranscriptOptions = {
  episodeId: string
  windowSizeSeconds?: number
  strideSeconds?: number
  createdAt?: string
}

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

  if (!cues.length) {
    return []
  }

  const transcriptEnd = Math.max(...cues.map((cue) => cue.end))
  const segments: Segment[] = []

  for (let start = 0; start < transcriptEnd; start += strideSeconds) {
    const end = Math.min(start + windowSizeSeconds, transcriptEnd)
    const text = collectWindowText(cues, start, end)

    if (!text) {
      continue
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
