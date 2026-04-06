import type { SpanMovieCandidateEvidence } from '../../domain/spanResolution.ts'

export type ResolvedCandidateForFiltering<T> = {
  confidence: number
  evidence: SpanMovieCandidateEvidence
  movie: T
}

export type CandidateFilterDecision = {
  keep: boolean
  reason: string
}

const MIN_TITLE_SIMILARITY = 0.6
const MIN_UNKNOWN_TV_TITLE_SIMILARITY = 0.85
const MIN_UNKNOWN_TV_CONFIDENCE = 0.75

export function shouldPersistResolvedCandidate<T>(
  candidate: ResolvedCandidateForFiltering<T>,
): CandidateFilterDecision {
  if (candidate.confidence <= 0) {
    return { keep: false, reason: 'zero_confidence' }
  }

  if (candidate.evidence.titleSimilarity < MIN_TITLE_SIMILARITY) {
    return { keep: false, reason: 'low_title_similarity' }
  }

  if (
    candidate.evidence.mediaType === 'tv' &&
    candidate.evidence.mediaTypeHint === 'unknown'
  ) {
    if (candidate.evidence.queryQualityTier === 'low') {
      return { keep: false, reason: 'low_quality_unknown_tv_candidate' }
    }

    if (
      candidate.evidence.queryQualityTier === 'medium' &&
      (candidate.evidence.titleSimilarity < MIN_UNKNOWN_TV_TITLE_SIMILARITY ||
        candidate.confidence < MIN_UNKNOWN_TV_CONFIDENCE)
    ) {
      return { keep: false, reason: 'weak_unknown_tv_candidate' }
    }

    if (
      candidate.evidence.queryQualityTier !== 'high' &&
      candidate.confidence < MIN_UNKNOWN_TV_CONFIDENCE
    ) {
      return { keep: false, reason: 'weak_unknown_tv_candidate' }
    }
  }

  return { keep: true, reason: 'passed_candidate_quality_gate' }
}

export function filterResolvedCandidatesBeforePersist<T>(
  candidates: ResolvedCandidateForFiltering<T>[],
) {
  return candidates.filter((candidate) =>
    shouldPersistResolvedCandidate(candidate).keep
  )
}
