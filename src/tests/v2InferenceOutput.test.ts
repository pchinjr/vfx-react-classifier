import { assertEquals, assertThrows } from '@std/assert'

import { ValidationError } from '../lib/errors.ts'
import { parseInferenceOutput } from '../v2/services/inference/parseInferenceOutput.ts'

Deno.test('parseInferenceOutput parses structured work inference JSON', () => {
  assertEquals(
    parseInferenceOutput(
      JSON.stringify({
        works: [
          {
            titleGuess: 'Pacific Rim',
            mediaType: 'movie',
            role: 'primary',
            confidence: 0.92,
            evidence: ['the kaiju fight in Pacific Rim'],
            rationale: 'The excerpt directly names the work.',
          },
        ],
      }),
    ),
    {
      works: [
        {
          titleGuess: 'Pacific Rim',
          mediaType: 'movie',
          role: 'primary',
          confidence: 0.92,
          evidence: ['the kaiju fight in Pacific Rim'],
          rationale: 'The excerpt directly names the work.',
        },
      ],
    },
  )
})

Deno.test('parseInferenceOutput rejects invalid roles', () => {
  assertThrows(
    () =>
      parseInferenceOutput(
        JSON.stringify({
          works: [
            {
              titleGuess: 'Pacific Rim',
              mediaType: 'movie',
              role: 'background',
              confidence: 0.92,
              evidence: [],
              rationale: null,
            },
          ],
        }),
      ),
    ValidationError,
    'Invalid work inference role',
  )
})
