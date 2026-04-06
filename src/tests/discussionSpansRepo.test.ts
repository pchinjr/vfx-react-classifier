import { assertEquals } from '@std/assert'

import type { DiscussionSpan } from '../domain/discussionSpan.ts'
import { nowIso } from '../lib/time.ts'
import {
  countDiscussionSpansForEpisode,
  getDiscussionSpansForEpisode,
  replaceDiscussionSpansForEpisode,
  upsertDiscussionSpans,
} from '../services/storage/discussionSpansRepo.ts'
import { upsertEpisode } from '../services/storage/episodesRepo.ts'
import { createTestDatabase } from '../services/storage/testDb.ts'

function span(id: string, start: number, end: number): DiscussionSpan {
  return {
    id,
    episodeId: 'ep_one',
    start,
    end,
    text: `span ${id}`,
    sourceSegmentCount: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

Deno.test('upsertDiscussionSpans is safe to rerun without duplicating spans', () => {
  const { db } = createTestDatabase('discussion-spans-repo-upsert')

  try {
    upsertEpisode(db, {
      id: 'ep_one',
      youtubeVideoId: 'abc123',
      title: 'Episode',
      sourceUrl: 'https://youtube.com/watch?v=abc123',
      createdAt: nowIso(),
    })

    upsertDiscussionSpans(db, [span('span_one', 0, 30)])
    upsertDiscussionSpans(db, [span('span_one', 0, 30)])

    assertEquals(countDiscussionSpansForEpisode(db, 'ep_one'), 1)
  } finally {
    db.close()
  }
})

Deno.test('replaceDiscussionSpansForEpisode removes stale spans for force rebuilds', () => {
  const { db } = createTestDatabase('discussion-spans-repo-replace')

  try {
    upsertEpisode(db, {
      id: 'ep_one',
      youtubeVideoId: 'abc123',
      title: 'Episode',
      sourceUrl: 'https://youtube.com/watch?v=abc123',
      createdAt: nowIso(),
    })

    upsertDiscussionSpans(db, [
      span('span_one', 0, 30),
      span('span_two', 40, 70),
    ])
    replaceDiscussionSpansForEpisode(db, 'ep_one', [span('span_three', 0, 70)])

    const spans = getDiscussionSpansForEpisode(db, 'ep_one')
    assertEquals(spans.map((item) => item.id), ['span_three'])
  } finally {
    db.close()
  }
})
