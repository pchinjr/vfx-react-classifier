import type { CatalogMediaType } from '../../../domain/movieCatalog.ts'
import { makeId } from '../../../lib/ids.ts'
import { nowIso } from '../../../lib/time.ts'
import type { AggregatedDiscussion } from '../../domain/aggregatedDiscussion.ts'
import type { WorkInferenceRole } from '../../domain/workInference.ts'

export type CanonicalMatchForAggregation = {
  workId: string
  mediaType: CatalogMediaType
  role: WorkInferenceRole
  windowStart: number
  windowEnd: number
  confidence: number
}

export type AggregateWorkInferencesOptions = {
  episodeId: string
  maxGapSeconds?: number
  createdAt?: string
}

const DEFAULT_MAX_GAP_SECONDS = 30

function boundaryKey(value: number) {
  return value.toFixed(3)
}

function aggregateId(input: {
  episodeId: string
  workId: string
  role: string
  start: number
  end: number
}) {
  return makeId(
    'v2agg',
    input.episodeId,
    input.workId,
    input.role,
    boundaryKey(input.start),
    boundaryKey(input.end),
  )
}

export function aggregateWorkInferences(
  matches: CanonicalMatchForAggregation[],
  options: AggregateWorkInferencesOptions,
): AggregatedDiscussion[] {
  const maxGapSeconds = options.maxGapSeconds ?? DEFAULT_MAX_GAP_SECONDS
  const createdAt = options.createdAt ?? nowIso()
  const ordered = [...matches].sort((left, right) =>
    left.workId.localeCompare(right.workId) ||
    left.role.localeCompare(right.role) ||
    left.windowStart - right.windowStart ||
    left.windowEnd - right.windowEnd
  )

  const discussions: AggregatedDiscussion[] = []
  let current:
    | {
      workId: string
      mediaType: CatalogMediaType
      role: WorkInferenceRole
      start: number
      end: number
      confidenceSum: number
      count: number
    }
    | null = null

  const flushCurrent = () => {
    if (!current) {
      return
    }

    discussions.push({
      id: aggregateId({
        episodeId: options.episodeId,
        workId: current.workId,
        role: current.role,
        start: current.start,
        end: current.end,
      }),
      episodeId: options.episodeId,
      workId: current.workId,
      mediaType: current.mediaType,
      start: current.start,
      end: current.end,
      role: current.role,
      confidence: Number((current.confidenceSum / current.count).toFixed(4)),
      createdAt,
    })
    current = null
  }

  for (const match of ordered) {
    if (!current) {
      current = {
        workId: match.workId,
        mediaType: match.mediaType,
        role: match.role,
        start: match.windowStart,
        end: match.windowEnd,
        confidenceSum: match.confidence,
        count: 1,
      }
      continue
    }

    const belongsToCurrent = match.workId === current.workId &&
      match.role === current.role &&
      match.windowStart <= current.end + maxGapSeconds

    if (!belongsToCurrent) {
      flushCurrent()
      current = {
        workId: match.workId,
        mediaType: match.mediaType,
        role: match.role,
        start: match.windowStart,
        end: match.windowEnd,
        confidenceSum: match.confidence,
        count: 1,
      }
      continue
    }

    current.end = Math.max(current.end, match.windowEnd)
    current.confidenceSum += match.confidence
    current.count += 1
  }

  flushCurrent()
  return discussions.sort((left, right) =>
    left.start - right.start ||
    left.end - right.end ||
    left.workId.localeCompare(right.workId)
  )
}
