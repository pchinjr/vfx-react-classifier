import OpenAI from 'openai'

import { getEnv } from '../../config/env.ts'
import { MissingApiKeyError } from '../../lib/errors.ts'
import { withTimeout } from '../../lib/async.ts'

export type EmbedTextResult = {
  model: string
  dimensions: number
  embeddings: number[][]
}

export type EmbedTextOptions = {
  model?: string
  client?: OpenAI
  maxRetries?: number
  timeoutMs?: number
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shouldRetry(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  return /429|timeout|temporar|rate limit|ECONNRESET|503/i.test(error.message)
}

// embedText is the single boundary to OpenAI embeddings. Batching happens in a
// higher-level service, but retries and request timeout handling live here.
export async function embedText(
  input: string | string[],
  options: EmbedTextOptions = {},
): Promise<EmbedTextResult> {
  const env = getEnv()
  const apiKey = env.openAiApiKey
  if (!apiKey) {
    throw new MissingApiKeyError()
  }

  const client = options.client ?? new OpenAI({ apiKey })
  const model = options.model ?? env.openAiEmbeddingModel
  const inputs = Array.isArray(input) ? input : [input]
  const maxRetries = options.maxRetries ?? 3
  const timeoutMs = options.timeoutMs ?? env.openAiTimeoutMs

  let attempt = 0
  while (true) {
    try {
      const response = await withTimeout(
        client.embeddings.create({
          model,
          input: inputs,
        }),
        timeoutMs,
        `OpenAI embeddings request timed out after ${timeoutMs}ms`,
      )

      const embeddings = response.data.map((item) => item.embedding)
      return {
        model: response.model,
        dimensions: embeddings[0]?.length ?? 0,
        embeddings,
      }
    } catch (error) {
      attempt += 1
      if (attempt > maxRetries || !shouldRetry(error)) {
        throw error
      }

      await sleep(300 * 2 ** (attempt - 1))
    }
  }
}
