import type { SearchResult } from '../../domain/search.ts'
import { logger } from '../../lib/logger.ts'
import type { DatabaseClient } from '../storage/db.ts'
import { searchCandidateSegments } from '../storage/searchRepo.ts'
import { cosineSimilarity } from './cosine.ts'
import { embedText, type EmbedTextOptions } from '../embeddings/embedText.ts'

export type SearchSegmentsOptions = EmbedTextOptions & {
  db: DatabaseClient
  limit?: number
  embedder?: typeof embedText
}

export async function searchSegments(
  queryText: string,
  options: SearchSegmentsOptions,
): Promise<SearchResult[]> {
  const startedAt = performance.now()
  const limit = options.limit ?? 5
  const embedder = options.embedder ?? embedText
  const queryEmbedding = await embedder(queryText, options)
  const candidates = searchCandidateSegments(options.db, queryEmbedding.model)

  const results = candidates
    .map((candidate) => ({
      segmentId: candidate.segmentId,
      episodeId: candidate.episodeId,
      episodeTitle: candidate.episodeTitle,
      start: candidate.start,
      end: candidate.end,
      text: candidate.text,
      score: cosineSimilarity(
        queryEmbedding.embeddings[0],
        candidate.embedding,
      ),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)

  logger.info('search.completed', {
    queryText,
    limit,
    candidates: candidates.length,
    latencyMs: Math.round(performance.now() - startedAt),
  })

  return results
}
