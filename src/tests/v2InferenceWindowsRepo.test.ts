import { assertEquals } from '@std/assert'

import { nowIso } from '../lib/time.ts'
import { upsertEpisode } from '../services/storage/episodesRepo.ts'
import { createTestDatabase } from '../services/storage/testDb.ts'
import type { InferenceWindow } from '../v2/domain/inferenceWindow.ts'
import {
  countInferenceWindowsForEpisode,
  getInferenceWindowsForEpisode,
  replaceInferenceWindowsForEpisode,
  upsertInferenceWindows,
} from '../v2/storage/inferenceWindowsRepo.ts'

function window(
  id: string,
  start: number,
  end: number,
): InferenceWindow {
  return {
    id,
    episodeId: 'ep_one',
    start,
    end,
    text: `window ${id}`,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

Deno.test('upsertInferenceWindows is safe to rerun without duplicating windows', () => {
  const { db } = createTestDatabase('v2-inference-windows-upsert')

  try {
    upsertEpisode(db, {
      id: 'ep_one',
      youtubeVideoId: 'abc123',
      title: 'Episode',
      sourceUrl: 'https://youtube.com/watch?v=abc123',
      createdAt: nowIso(),
    })

    upsertInferenceWindows(db, [window('window_one', 0, 45)])
    upsertInferenceWindows(db, [window('window_one', 0, 45)])

    assertEquals(countInferenceWindowsForEpisode(db, 'ep_one'), 1)
  } finally {
    db.close()
  }
})

Deno.test('replaceInferenceWindowsForEpisode removes stale windows for force rebuilds', () => {
  const { db } = createTestDatabase('v2-inference-windows-replace')

  try {
    upsertEpisode(db, {
      id: 'ep_one',
      youtubeVideoId: 'abc123',
      title: 'Episode',
      sourceUrl: 'https://youtube.com/watch?v=abc123',
      createdAt: nowIso(),
    })

    upsertInferenceWindows(db, [
      window('window_one', 0, 45),
      window('window_two', 15, 60),
    ])
    replaceInferenceWindowsForEpisode(db, 'ep_one', [
      window('window_three', 0, 60),
    ])

    const windows = getInferenceWindowsForEpisode(db, 'ep_one')
    assertEquals(windows.map((item) => item.id), ['window_three'])
  } finally {
    db.close()
  }
})
