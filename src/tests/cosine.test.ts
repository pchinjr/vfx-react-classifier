import { assertEquals } from '@std/assert'

import { cosineSimilarity } from '../services/search/cosine.ts'

Deno.test('cosineSimilarity returns 1 for identical vectors', () => {
  assertEquals(cosineSimilarity([1, 2, 3], [1, 2, 3]), 1)
})

Deno.test('cosineSimilarity returns 0 for orthogonal vectors', () => {
  assertEquals(cosineSimilarity([1, 0], [0, 1]), 0)
})
