export type WorkInferenceMediaType = 'movie' | 'tv' | 'unknown'
export type WorkInferenceRole = 'primary' | 'secondary'

export type WorkInference = {
  id: string
  windowId: string
  titleGuess: string
  mediaType: WorkInferenceMediaType
  role: WorkInferenceRole
  confidence: number
  evidence: string[]
  rationale?: string
  modelVersion: string
  promptVersion: string
  createdAt: string
}
