import { assertEquals } from '@std/assert'

import type { Segment } from '../domain/segment.ts'
import { nowIso } from '../lib/time.ts'
import { searchSegments } from '../services/search/searchSegments.ts'
import { upsertEpisode } from '../services/storage/episodesRepo.ts'
import {
  replaceSegmentsForEpisode,
  upsertSegmentEmbeddings,
} from '../services/storage/segmentsRepo.ts'
import { createTestDatabase } from '../services/storage/testDb.ts'
import { normalizeTranscript } from '../services/transcript/normalizeTranscript.ts'
import { segmentTranscript } from '../services/transcript/segmentTranscript.ts'
import type { EmbedTextResult } from '../services/embeddings/embedText.ts'

function mockVectorForText(text: string) {
  const normalized = text.toLowerCase()
  if (normalized.includes('jurassic') || normalized.includes('t-rex')) {
    return [1, 0, 0]
  }
  if (normalized.includes('cats')) {
    return [0, 1, 0]
  }
  if (normalized.includes('de-aging') || normalized.includes('de aging')) {
    return [0, 0, 1]
  }
  return [0.1, 0.1, 0.1]
}

Deno.test('integration search returns segments in semantic order', async () => {
  const { db } = createTestDatabase('search-integration')

  try {
    const cues = normalizeTranscript(
      JSON.parse(
        await Deno.readTextFile(
          new URL('./fixtures/sampleTranscript.json', import.meta.url),
        ),
      ),
    )
    const createdAt = nowIso()

    upsertEpisode(db, {
      id: 'ep_fixture',
      youtubeVideoId: 'fixture123',
      title: 'Fixture Episode',
      sourceUrl: 'https://youtube.com/watch?v=fixture123',
      createdAt,
    })

    const segments = segmentTranscript(cues, {
      episodeId: 'ep_fixture',
      windowSizeSeconds: 15,
      strideSeconds: 10,
      createdAt,
    })
    replaceSegmentsForEpisode(db, 'ep_fixture', segments)

    upsertSegmentEmbeddings(
      db,
      segments.map((segment: Segment) => ({
        segmentId: segment.id,
        model: 'mock-embedding-model',
        dimensions: 3,
        embedding: mockVectorForText(segment.text),
        createdAt,
      })),
    )

    const mockEmbedder = (
      input: string | string[],
    ): Promise<EmbedTextResult> => {
      const values = Array.isArray(input) ? input : [input]
      return Promise.resolve({
        model: 'mock-embedding-model',
        dimensions: 3,
        embeddings: values.map(mockVectorForText),
      })
    }

    const results = await searchSegments('Jurassic Park T-Rex', {
      db,
      model: 'mock-embedding-model',
      embedder: mockEmbedder,
      limit: 2,
      maxRetries: 0,
    })

    assertEquals(results[0]?.episodeTitle, 'Fixture Episode')
    assertEquals(
      results[0]?.text.includes('Jurassic Park T-Rex'.split(' ')[0]),
      true,
    )
  } finally {
    db.close()
  }
})
