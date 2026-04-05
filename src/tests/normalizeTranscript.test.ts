import { assertEquals } from '@std/assert'

import { normalizeTranscript } from '../services/transcript/normalizeTranscript.ts'

Deno.test('normalizeTranscript trims whitespace and merges repeated cues', () => {
  const normalized = normalizeTranscript([
    { start: 0, end: 1, text: ' hello   world ' },
    { start: 1, end: 2, text: '[Music]' },
    { start: 2, end: 4, text: 'hello world' },
    { start: 4, end: 5, text: 'new line' },
  ])

  assertEquals(normalized, [
    { start: 0, end: 4, text: 'hello world' },
    { start: 4, end: 5, text: 'new line' },
  ])
})
