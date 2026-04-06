export type SpanResolutionStatus = 'running' | 'completed' | 'failed'

export type SpanResolutionRun = {
  id: string
  episodeId: string
  resolverVersion: string
  startedAt: string
  completedAt?: string
  status: SpanResolutionStatus
  notes?: string
}

export type SpanMovieCandidateEvidence = {
  searchQuery: string
  matchedTitle: string
  titleSimilarity: number
  overviewOverlap: number
  releaseYearMentioned?: number
}

export type SpanMovieCandidate = {
  id: string
  spanId: string
  movieId: string
  rank: number
  confidence: number
  resolverVersion: string
  evidenceJson: string
  createdAt: string
}
