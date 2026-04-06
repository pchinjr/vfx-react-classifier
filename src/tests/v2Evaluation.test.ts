import { assertEquals } from '@std/assert'

import { evaluateV2ReviewCoverage } from '../v2/services/evaluation/evaluateV2ReviewCoverage.ts'

Deno.test('evaluateV2ReviewCoverage summarizes review coverage and decisions', () => {
  const summary = evaluateV2ReviewCoverage({
    episodeId: 'ep_one',
    inferenceIds: ['inference_one', 'inference_two'],
    discussionIds: ['discussion_one'],
    decisions: [
      {
        id: 'review_one',
        targetType: 'inference',
        targetId: 'inference_one',
        decision: 'confirmed',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'review_two',
        targetType: 'discussion',
        targetId: 'discussion_one',
        decision: 'corrected',
        workId: 'movie_pacific_rim',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  })

  assertEquals(summary, {
    episodeId: 'ep_one',
    inferenceCount: 2,
    discussionCount: 1,
    reviewedInferenceCount: 1,
    reviewedDiscussionCount: 1,
    decisionCounts: {
      confirmed: 1,
      corrected: 1,
      rejected: 0,
    },
    inferenceReviewCoverage: 0.5,
    discussionReviewCoverage: 1,
  })
})
