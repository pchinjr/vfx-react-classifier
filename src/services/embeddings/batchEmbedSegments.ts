import type { SegmentEmbedding } from '../../domain/embedding.ts'
import type { Segment } from '../../domain/segment.ts'
import { logger } from '../../lib/logger.ts'
import { nowIso } from '../../lib/time.ts'
import { upsertSegmentEmbeddings } from '../storage/segmentsRepo.ts'
import type { DatabaseClient } from '../storage/db.ts'
import { embedText, type EmbedTextOptions } from './embedText.ts'

export type BatchEmbedSegmentsOptions = EmbedTextOptions & {
  batchSize?: number
  db?: DatabaseClient
}

export async function batchEmbedSegments(
  segments: Segment[],
  options: BatchEmbedSegmentsOptions = {},
): Promise<SegmentEmbedding[]> {
  const batchSize = options.batchSize ?? 32
  const embeddings: SegmentEmbedding[] = []

  for (let index = 0; index < segments.length; index += batchSize) {
    const batch = segments.slice(index, index + batchSize)
    if (!batch.length) {
      continue
    }

    logger.info('embeddings.batch.start', {
      batchIndex: index / batchSize,
      batchSize: batch.length,
    })

    const result = await embedText(
      batch.map((segment) => segment.text),
      options,
    )

    const createdAt = nowIso()
    const mapped = batch.map((segment, itemIndex) => ({
      segmentId: segment.id,
      model: result.model,
      dimensions: result.dimensions,
      embedding: result.embeddings[itemIndex],
      createdAt,
    }))

    embeddings.push(...mapped)

    if (options.db) {
      upsertSegmentEmbeddings(options.db, mapped)
    }

    logger.info('embeddings.batch.complete', {
      batchIndex: index / batchSize,
      batchSize: batch.length,
    })
  }

  return embeddings
}
