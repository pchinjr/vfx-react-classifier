import { assertEquals, assertRejects } from '@std/assert'

import { ValidationError } from '../lib/errors.ts'
import { loadTranscriptFile } from '../services/transcript/loadTranscriptFile.ts'

Deno.test('loadTranscriptFile parses VTT transcripts', async () => {
  const path = await Deno.makeTempFile({ suffix: '.vtt' })

  try {
    await Deno.writeTextFile(
      path,
      `WEBVTT

00:00:01.000 --> 00:00:03.000
hello world
`,
    )

    const cues = await loadTranscriptFile(path)
    assertEquals(cues, [{ start: 1, end: 3, text: 'hello world' }])
  } finally {
    await Deno.remove(path).catch(() => undefined)
  }
})

Deno.test('loadTranscriptFile parses cue-array JSON transcripts', async () => {
  const path = await Deno.makeTempFile({ suffix: '.json' })

  try {
    await Deno.writeTextFile(
      path,
      JSON.stringify([{ start: 0, end: 2, text: 'hello json' }]),
    )

    const cues = await loadTranscriptFile(path)
    assertEquals(cues, [{ start: 0, end: 2, text: 'hello json' }])
  } finally {
    await Deno.remove(path).catch(() => undefined)
  }
})

Deno.test('loadTranscriptFile rejects unsupported transcript extensions', async () => {
  const path = await Deno.makeTempFile({ suffix: '.txt' })

  try {
    await Deno.writeTextFile(path, 'plain text transcript')

    await assertRejects(
      () => loadTranscriptFile(path),
      ValidationError,
      'Unsupported transcript file extension',
    )
  } finally {
    await Deno.remove(path).catch(() => undefined)
  }
})
