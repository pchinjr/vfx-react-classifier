export type ReviewTargetType = 'inference' | 'discussion'
export type ReviewDecisionValue = 'confirmed' | 'corrected' | 'rejected'

export type ReviewDecision = {
  id: string
  targetType: ReviewTargetType
  targetId: string
  decision: ReviewDecisionValue
  workId?: string
  notes?: string
  createdAt: string
}

const targetTypes = new Set<ReviewTargetType>(['inference', 'discussion'])
const decisionValues = new Set<ReviewDecisionValue>([
  'confirmed',
  'corrected',
  'rejected',
])

export function isReviewTargetType(value: string): value is ReviewTargetType {
  return targetTypes.has(value as ReviewTargetType)
}

export function isReviewDecisionValue(
  value: string,
): value is ReviewDecisionValue {
  return decisionValues.has(value as ReviewDecisionValue)
}
