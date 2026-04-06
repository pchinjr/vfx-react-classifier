import { assertEquals } from '@std/assert'

import { nowIso } from '../lib/time.ts'
import { upsertEpisode } from '../services/storage/episodesRepo.ts'
import { createTestDatabase } from '../services/storage/testDb.ts'
import type { InferenceWindow } from '../v2/domain/inferenceWindow.ts'
import type { WorkInference } from '../v2/domain/workInference.ts'
import { upsertInferenceWindows } from '../v2/storage/inferenceWindowsRepo.ts'
import {
  deleteWorkInferencesForEpisode,
  getWorkInferencesForEpisode,
  upsertWorkInferences,
} from '../v2/storage/workInferencesRepo.ts'

const createdAt = '2026-01-01T00:00:00.000Z'

function window(id: string): InferenceWindow {
  return {
    id,
    episodeId: 'ep_one',
    start: 0,
    end: 45,
    text: `window ${id}`,
    createdAt,
  }
}

function inference(id: string, windowId = 'window_one'): WorkInference {
  return {
    id,
    windowId,
    titleGuess: 'Pacific Rim',
    mediaType: 'movie',
    role: 'primary',
    confidence: 0.92,
    evidence: ['Pacific Rim'],
    modelVersion: 'test-model',
    promptVersion: 'test-prompt',
    createdAt,
  }
}

Deno.test('upsertWorkInferences stores parsed evidence and supports episode deletion', () => {
  const { db } = createTestDatabase('v2-work-inferences')

  try {
    upsertEpisode(db, {
      id: 'ep_one',
      youtubeVideoId: 'abc123',
      title: 'Episode',
      sourceUrl: 'https://youtube.com/watch?v=abc123',
      createdAt: nowIso(),
    })
    upsertInferenceWindows(db, [window('window_one')])

    upsertWorkInferences(db, [inference('inference_one')])
    upsertWorkInferences(db, [
      { ...inference('inference_one'), confidence: 0.87 },
    ])

    assertEquals(
      getWorkInferencesForEpisode(db, 'ep_one').map((item) => ({
        id: item.id,
        titleGuess: item.titleGuess,
        confidence: item.confidence,
        evidence: item.evidence,
      })),
      [
        {
          id: 'inference_one',
          titleGuess: 'Pacific Rim',
          confidence: 0.87,
          evidence: ['Pacific Rim'],
        },
      ],
    )

    deleteWorkInferencesForEpisode(db, 'ep_one', 'test-model', 'test-prompt')
    assertEquals(getWorkInferencesForEpisode(db, 'ep_one'), [])
  } finally {
    db.close()
  }
})
