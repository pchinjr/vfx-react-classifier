import type { ReviewDecisionValue } from './reviewDecision.ts'

export type V2EvaluationSummary = {
  episodeId: string
  inferenceCount: number
  discussionCount: number
  reviewedInferenceCount: number
  reviewedDiscussionCount: number
  decisionCounts: Record<ReviewDecisionValue, number>
  inferenceReviewCoverage: number
  discussionReviewCoverage: number
}
