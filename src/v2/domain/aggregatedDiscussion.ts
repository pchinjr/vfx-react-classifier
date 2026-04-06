import type { CatalogMediaType } from '../../domain/movieCatalog.ts'
import type { WorkInferenceRole } from './workInference.ts'

export type AggregatedDiscussion = {
  id: string
  episodeId: string
  workId: string
  mediaType: CatalogMediaType
  start: number
  end: number
  role: WorkInferenceRole
  confidence: number
  createdAt: string
}
