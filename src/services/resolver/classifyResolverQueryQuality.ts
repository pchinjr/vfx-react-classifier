import type { ResolverQueryQualityTier } from './queryTypes.ts'

export function classifyResolverQueryQuality(
  score: number,
): ResolverQueryQualityTier {
  if (score >= 0.85) {
    return 'high'
  }

  if (score >= 0.55) {
    return 'medium'
  }

  return 'low'
}
