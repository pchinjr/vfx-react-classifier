import { assertEquals, assertThrows } from '@std/assert'

import { ValidationError } from '../lib/errors.ts'
import { buildInferenceWindows } from '../v2/services/windows/buildInferenceWindows.ts'

Deno.test('buildInferenceWindows creates deterministic overlapping text windows', () => {
  const windows = buildInferenceWindows(
    [
      { start: 0, end: 10, text: 'Pacific Rim opens' },
      { start: 18, end: 30, text: 'the kaiju fight continues' },
      { start: 33, end: 50, text: 'then they compare Godzilla' },
    ],
    {
      episodeId: 'ep_one',
      windowSizeSeconds: 30,
      strideSeconds: 15,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  )

  assertEquals(
    windows.map((window) => ({
      start: window.start,
      end: window.end,
      text: window.text,
      createdAt: window.createdAt,
    })),
    [
      {
        start: 0,
        end: 30,
        text: 'Pacific Rim opens the kaiju fight continues',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        start: 15,
        end: 45,
        text: 'the kaiju fight continues then they compare Godzilla',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        start: 30,
        end: 50,
        text: 'then they compare Godzilla',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  )

  assertEquals(windows.map((window) => window.id), [
    'v2win_558b66bb',
    'v2win_845bc611',
    'v2win_2528d699',
  ])
})

Deno.test('buildInferenceWindows validates non-advancing settings', () => {
  assertThrows(
    () =>
      buildInferenceWindows(
        [{ start: 0, end: 10, text: 'text' }],
        { episodeId: 'ep_one', strideSeconds: 0 },
      ),
    ValidationError,
    'strideSeconds must be a positive number',
  )
})
