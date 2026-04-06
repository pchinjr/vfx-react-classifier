import type { DiscussionSpan } from '../../domain/discussionSpan.ts'
import type { Segment } from '../../domain/segment.ts'
import { makeId } from '../../lib/ids.ts'
import { nowIso } from '../../lib/time.ts'

export type BuildDiscussionSpansOptions = {
  maxGapSeconds?: number
  maxSpanSeconds?: number
  createdAt?: string
}

const DEFAULT_MAX_GAP_SECONDS = 15
const DEFAULT_MAX_SPAN_SECONDS = 180

function spanBoundaryKey(value: number) {
  return value.toFixed(3)
}

function normalizeSpanText(parts: string[]) {
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function makeSpanId(episodeId: string, start: number, end: number) {
  return makeId('span', episodeId, spanBoundaryKey(start), spanBoundaryKey(end))
}

// Phase 2 starts with a deterministic time-based merge. This intentionally does
// not try to infer movie boundaries; it only converts overlapping v1 retrieval
// windows into larger reviewable discussion spans.
export function buildDiscussionSpans(
  segments: Segment[],
  options: BuildDiscussionSpansOptions = {},
): DiscussionSpan[] {
  const maxGapSeconds = options.maxGapSeconds ?? DEFAULT_MAX_GAP_SECONDS
  const maxSpanSeconds = options.maxSpanSeconds ?? DEFAULT_MAX_SPAN_SECONDS
  const createdAt = options.createdAt ?? nowIso()
  const orderedSegments = [...segments].sort((left, right) =>
    left.episodeId.localeCompare(right.episodeId) || left.start - right.start ||
    left.end - right.end || left.id.localeCompare(right.id)
  )
  const spans: DiscussionSpan[] = []
  let current:
    | {
      episodeId: string
      start: number
      end: number
      textParts: string[]
      sourceSegmentCount: number
    }
    | null = null

  const flushCurrent = () => {
    if (!current) {
      return
    }

    spans.push({
      id: makeSpanId(current.episodeId, current.start, current.end),
      episodeId: current.episodeId,
      start: current.start,
      end: current.end,
      text: normalizeSpanText(current.textParts),
      sourceSegmentCount: current.sourceSegmentCount,
      createdAt,
    })
    current = null
  }

  for (const segment of orderedSegments) {
    if (!segment.text.trim()) {
      continue
    }

    if (!current) {
      current = {
        episodeId: segment.episodeId,
        start: segment.start,
        end: segment.end,
        textParts: [segment.text],
        sourceSegmentCount: 1,
      }
      continue
    }

    const belongsToCurrentSpan = segment.episodeId === current.episodeId &&
      segment.start <= current.end + maxGapSeconds &&
      segment.end - current.start <= maxSpanSeconds

    if (!belongsToCurrentSpan) {
      flushCurrent()
      current = {
        episodeId: segment.episodeId,
        start: segment.start,
        end: segment.end,
        textParts: [segment.text],
        sourceSegmentCount: 1,
      }
      continue
    }

    current.end = Math.max(current.end, segment.end)
    current.textParts.push(segment.text)
    current.sourceSegmentCount += 1
  }

  flushCurrent()
  return spans
}
