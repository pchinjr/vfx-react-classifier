import type {
  CatalogMediaType,
  MovieCatalogRecord,
} from '../../../domain/movieCatalog.ts'
import { makeId } from '../../../lib/ids.ts'
import { nowIso } from '../../../lib/time.ts'
import { normalizeResolverText } from '../../../services/resolver/text.ts'
import type { CanonicalWorkMatch } from '../../domain/canonicalWorkMatch.ts'
import type { WorkInference } from '../../domain/workInference.ts'

export type CanonicalizeInferenceOptions = {
  searchWorks: (
    query: string,
    mediaTypeHint: CatalogMediaType | 'unknown',
  ) => Promise<MovieCatalogRecord[]> | MovieCatalogRecord[]
  now?: string
  minMatchConfidence?: number
}

export type CanonicalizeInferenceResult = {
  works: MovieCatalogRecord[]
  match?: CanonicalWorkMatch
}

const DEFAULT_MIN_MATCH_CONFIDENCE = 0.5

function tokenSet(value: string) {
  return new Set(normalizeResolverText(value).split(/\s+/).filter(Boolean))
}

function titleSimilarity(left: string, right: string) {
  const leftTokens = tokenSet(left)
  const rightTokens = tokenSet(right)
  if (!leftTokens.size || !rightTokens.size) {
    return 0
  }

  let overlap = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1
    }
  }

  return overlap / Math.max(leftTokens.size, rightTokens.size)
}

function mediaTypeHintFor(
  inference: WorkInference,
): CatalogMediaType | 'unknown' {
  return inference.mediaType === 'movie' || inference.mediaType === 'tv'
    ? inference.mediaType
    : 'unknown'
}

function matchConfidence(inference: WorkInference, work: MovieCatalogRecord) {
  const titleScore = Math.max(
    titleSimilarity(inference.titleGuess, work.title),
    work.originalTitle
      ? titleSimilarity(inference.titleGuess, work.originalTitle)
      : 0,
  )

  const mediaTypeBoost = inference.mediaType === work.mediaType ? 0.05 : 0
  return Math.min(
    1,
    Number(
      (titleScore * 0.8 + inference.confidence * 0.15 + mediaTypeBoost)
        .toFixed(4),
    ),
  )
}

export async function canonicalizeInference(
  inference: WorkInference,
  options: CanonicalizeInferenceOptions,
): Promise<CanonicalizeInferenceResult> {
  const works = await options.searchWorks(
    inference.titleGuess,
    mediaTypeHintFor(inference),
  )
  const minMatchConfidence = options.minMatchConfidence ??
    DEFAULT_MIN_MATCH_CONFIDENCE
  const createdAt = options.now ?? nowIso()

  const best = [...works]
    .map((work) => ({
      work,
      confidence: matchConfidence(inference, work),
    }))
    .sort((left, right) =>
      right.confidence - left.confidence ||
      left.work.title.localeCompare(right.work.title)
    )[0]

  if (!best || best.confidence < minMatchConfidence) {
    return { works }
  }

  return {
    works,
    match: {
      id: makeId('v2match', inference.id, best.work.id),
      inferenceId: inference.id,
      workId: best.work.id,
      matchConfidence: best.confidence,
      createdAt,
    },
  }
}
