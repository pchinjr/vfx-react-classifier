export type CandidateTrainingSplit = 'train' | 'validation' | 'test'

export type CandidateTrainingRow = {
  spanId: string
  episodeId: string
  candidateMovieId: string
  label: 0 | 1
  resolverVersion: string
  spanText: string
  movieTitle: string
  movieOriginalTitle?: string
  movieOverview?: string
  releaseYear?: number
  popularity?: number
  voteCount?: number
  featureJson: string
  split: CandidateTrainingSplit
}
