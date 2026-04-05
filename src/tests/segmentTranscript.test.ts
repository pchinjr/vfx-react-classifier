import { assertEquals, assertThrows } from '@std/assert'

import { ValidationError } from '../lib/errors.ts'
import { segmentTranscript } from '../services/transcript/segmentTranscript.ts'

Deno.test('segmentTranscript creates overlapping windows with deterministic ids', () => {
  const segments = segmentTranscript(
    [
      { start: 0, end: 10, text: 'intro' },
      { start: 10, end: 20, text: 'the t rex scene' },
      { start: 20, end: 30, text: 'breakdown continues' },
    ],
    {
      episodeId: 'ep_1',
      windowSizeSeconds: 20,
      strideSeconds: 10,
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  )

  assertEquals(
    segments.map((segment) => ({
      id: segment.id,
      start: segment.start,
      end: segment.end,
      text: segment.text,
    })),
    [
      {
        id: 'seg_701a4bb6',
        start: 0,
        end: 20,
        text: 'intro the t rex scene',
      },
      {
        id: 'seg_f372cde7',
        start: 10,
        end: 30,
        text: 'the t rex scene breakdown continues',
      },
    ],
  )
})

Deno.test('segmentTranscript skips empty windows', () => {
  const segments = segmentTranscript(
    [{ start: 5, end: 8, text: 'single cue' }],
    {
      episodeId: 'ep_1',
      windowSizeSeconds: 2,
      strideSeconds: 2,
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  )

  assertEquals(
    segments.map((segment) => [segment.start, segment.end, segment.text]),
    [
      [4, 6, 'single cue'],
      [6, 8, 'single cue'],
    ],
  )
})

Deno.test('segmentTranscript rejects non-positive stride', () => {
  assertThrows(
    () =>
      segmentTranscript(
        [{ start: 0, end: 10, text: 'cue' }],
        {
          episodeId: 'ep_1',
          windowSizeSeconds: 10,
          strideSeconds: 0,
        },
      ),
    ValidationError,
    'strideSeconds must be a positive number',
  )
})

Deno.test('segmentTranscript rejects segment counts beyond configured max', () => {
  assertThrows(
    () =>
      segmentTranscript(
        [
          { start: 0, end: 10, text: 'one' },
          { start: 10, end: 20, text: 'two' },
          { start: 20, end: 30, text: 'three' },
        ],
        {
          episodeId: 'ep_1',
          windowSizeSeconds: 10,
          strideSeconds: 5,
          maxSegments: 1,
        },
      ),
    ValidationError,
    'Segment generation exceeded configured maxSegments=1',
  )
})
