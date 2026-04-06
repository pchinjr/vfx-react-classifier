import type { ReviewDecision } from '../../domain/reviewDecision.ts'
import type { V2EvaluationSummary } from '../../domain/v2Evaluation.ts'

export function evaluateV2ReviewCoverage(input: {
  episodeId: string
  inferenceIds: string[]
  discussionIds: string[]
  decisions: ReviewDecision[]
}): V2EvaluationSummary {
  const inferenceIds = new Set(input.inferenceIds)
  const discussionIds = new Set(input.discussionIds)
  const reviewedInferenceIds = new Set<string>()
  const reviewedDiscussionIds = new Set<string>()
  const decisionCounts = {
    confirmed: 0,
    corrected: 0,
    rejected: 0,
  }

  for (const decision of input.decisions) {
    decisionCounts[decision.decision] += 1

    if (
      decision.targetType === 'inference' && inferenceIds.has(decision.targetId)
    ) {
      reviewedInferenceIds.add(decision.targetId)
    }
    if (
      decision.targetType === 'discussion' &&
      discussionIds.has(decision.targetId)
    ) {
      reviewedDiscussionIds.add(decision.targetId)
    }
  }

  return {
    episodeId: input.episodeId,
    inferenceCount: inferenceIds.size,
    discussionCount: discussionIds.size,
    reviewedInferenceCount: reviewedInferenceIds.size,
    reviewedDiscussionCount: reviewedDiscussionIds.size,
    decisionCounts,
    inferenceReviewCoverage: coverage(
      reviewedInferenceIds.size,
      inferenceIds.size,
    ),
    discussionReviewCoverage: coverage(
      reviewedDiscussionIds.size,
      discussionIds.size,
    ),
  }
}

function coverage(reviewedCount: number, targetCount: number) {
  if (targetCount === 0) {
    return 0
  }

  return reviewedCount / targetCount
}
