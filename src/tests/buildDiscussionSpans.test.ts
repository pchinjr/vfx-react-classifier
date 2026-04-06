import { assertEquals } from '@std/assert'

import type { Segment } from '../domain/segment.ts'
import { buildDiscussionSpans } from '../services/spans/buildDiscussionSpans.ts'

function segment(
  id: string,
  episodeId: string,
  start: number,
  end: number,
  text: string,
): Segment {
  return {
    id,
    episodeId,
    start,
    end,
    text,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

Deno.test('buildDiscussionSpans merges overlapping and nearby segments deterministically', () => {
  const spans = buildDiscussionSpans(
    [
      segment('seg_2', 'ep_one', 20, 50, 'middle'),
      segment('seg_1', 'ep_one', 0, 30, 'start'),
      segment('seg_3', 'ep_one', 62, 90, 'nearby'),
    ],
    { createdAt: '2026-01-01T00:00:00.000Z', maxGapSeconds: 15 },
  )

  assertEquals(spans.length, 1)
  assertEquals(spans[0], {
    id: 'span_d6253d64',
    episodeId: 'ep_one',
    start: 0,
    end: 90,
    text: 'start middle nearby',
    sourceSegmentCount: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
  })
})

Deno.test('buildDiscussionSpans starts a new span when the time gap is too large', () => {
  const spans = buildDiscussionSpans(
    [
      segment('seg_1', 'ep_one', 0, 30, 'first'),
      segment('seg_2', 'ep_one', 61, 90, 'second'),
    ],
    { createdAt: '2026-01-01T00:00:00.000Z', maxGapSeconds: 15 },
  )

  assertEquals(spans.map((span) => span.text), ['first', 'second'])
})

Deno.test('buildDiscussionSpans never merges across episodes', () => {
  const spans = buildDiscussionSpans(
    [
      segment('seg_1', 'ep_one', 0, 30, 'first episode'),
      segment('seg_2', 'ep_two', 10, 40, 'second episode'),
    ],
    { createdAt: '2026-01-01T00:00:00.000Z' },
  )

  assertEquals(spans.map((span) => span.episodeId), ['ep_one', 'ep_two'])
})

Deno.test('buildDiscussionSpans caps spans so sliding windows do not chain an entire episode', () => {
  const spans = buildDiscussionSpans(
    [
      segment('seg_1', 'ep_one', 0, 30, 'first'),
      segment('seg_2', 'ep_one', 15, 45, 'second'),
      segment('seg_3', 'ep_one', 30, 60, 'third'),
    ],
    {
      createdAt: '2026-01-01T00:00:00.000Z',
      maxGapSeconds: 15,
      maxSpanSeconds: 45,
    },
  )

  assertEquals(spans.map((span) => span.text), ['first second', 'third'])
})
