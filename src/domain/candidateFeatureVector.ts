export const CANDIDATE_FEATURE_SCHEMA_VERSION = 'candidate-features-v1'

export type CandidateFeatureValues = {
  heuristicRank: number
  heuristicConfidence: number
  queryTitleSimilarity: number
  queryOverviewOverlap: number
  exactTitleInSpan: number
  titleMentionCount: number
  titleTokenOverlap: number
  overviewTokenOverlap: number
  releaseYearMentioned: number
  comparativeContext: number
  popularity: number
  logVoteCount: number
  candidateCount: number
  sameNormalizedTitleCount: number
}

export type CandidateFeatureVector = {
  schemaVersion: typeof CANDIDATE_FEATURE_SCHEMA_VERSION
  featureOrder: Array<keyof CandidateFeatureValues>
  values: CandidateFeatureValues
}
