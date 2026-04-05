import { assertRejects } from '@std/assert'

import { TimeoutError } from '../lib/errors.ts'
import { embedText } from '../services/embeddings/embedText.ts'
import { runYtDlp } from '../services/youtube/runYtDlp.ts'

Deno.test('embedText times out stalled embedding requests', async () => {
  Deno.env.set('OPENAI_API_KEY', 'test-key')

  const client = {
    embeddings: {
      create: () => new Promise(() => undefined),
    },
  }

  await assertRejects(
    () =>
      embedText('hello', {
        client: client as never,
        maxRetries: 0,
        timeoutMs: 25,
      }),
    TimeoutError,
    'OpenAI embeddings request timed out',
  )
})

Deno.test({
  name: 'runYtDlp times out stalled subprocesses',
  permissions: { run: true },
  fn: async () => {
    await assertRejects(
      () => runYtDlp('bash', ['-lc', 'sleep 2'], { timeoutMs: 25 }),
      TimeoutError,
      'yt-dlp timed out',
    )
  },
})
