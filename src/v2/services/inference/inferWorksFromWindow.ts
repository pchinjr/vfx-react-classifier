import OpenAI from 'openai'

import { getEnv } from '../../../config/env.ts'
import { withTimeout } from '../../../lib/async.ts'
import { makeId } from '../../../lib/ids.ts'
import { MissingApiKeyError, ValidationError } from '../../../lib/errors.ts'
import { nowIso } from '../../../lib/time.ts'
import type { InferenceWindow } from '../../domain/inferenceWindow.ts'
import type { WorkInference } from '../../domain/workInference.ts'
import {
  buildWorkInferenceSystemPrompt,
  buildWorkInferenceUserPrompt,
  V2_WORK_INFERENCE_PROMPT_VERSION,
} from './promptTemplates.ts'
import {
  type ParsedWorkInference,
  parseInferenceOutput,
} from './parseInferenceOutput.ts'

export type InferWorksFromWindowOptions = {
  client?: OpenAI
  model?: string
  promptVersion?: string
  episodeTitle?: string
  now?: string
  timeoutMs?: number
}

const WORK_INFERENCE_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'v2_work_inference',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['works'],
      properties: {
        works: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: [
              'titleGuess',
              'mediaType',
              'role',
              'confidence',
              'evidence',
              'rationale',
            ],
            properties: {
              titleGuess: { type: 'string' },
              mediaType: { type: 'string', enum: ['movie', 'tv', 'unknown'] },
              role: { type: 'string', enum: ['primary', 'secondary'] },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              evidence: {
                type: 'array',
                items: { type: 'string' },
              },
              rationale: { type: ['string', 'null'] },
            },
          },
        },
      },
    },
  },
} as const

function makeInferenceId(
  windowId: string,
  work: ParsedWorkInference,
  modelVersion: string,
  promptVersion: string,
) {
  return makeId(
    'v2inf',
    windowId,
    work.titleGuess,
    work.mediaType,
    work.role,
    modelVersion,
    promptVersion,
  )
}

export async function inferWorksFromWindow(
  window: InferenceWindow,
  options: InferWorksFromWindowOptions = {},
): Promise<WorkInference[]> {
  const env = getEnv()
  const apiKey = env.openAiApiKey
  if (!apiKey) {
    throw new MissingApiKeyError('OPENAI_API_KEY is required for V2 inference')
  }

  const client = options.client ?? new OpenAI({ apiKey })
  const model = options.model ?? env.openAiInferenceModel
  const promptVersion = options.promptVersion ??
    V2_WORK_INFERENCE_PROMPT_VERSION
  const createdAt = options.now ?? nowIso()
  const timeoutMs = options.timeoutMs ?? env.openAiTimeoutMs

  const completion = await withTimeout(
    client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: buildWorkInferenceSystemPrompt() },
        {
          role: 'user',
          content: buildWorkInferenceUserPrompt({
            episodeTitle: options.episodeTitle,
            start: window.start,
            end: window.end,
            text: window.text,
          }),
        },
      ],
      response_format: WORK_INFERENCE_RESPONSE_FORMAT,
    }),
    timeoutMs,
    `OpenAI V2 inference request timed out after ${timeoutMs}ms`,
  )

  const content = completion.choices[0]?.message.content
  if (!content) {
    throw new ValidationError('OpenAI V2 inference response was empty')
  }

  const parsed = parseInferenceOutput(content)
  return parsed.works.map((work) => ({
    id: makeInferenceId(window.id, work, model, promptVersion),
    windowId: window.id,
    titleGuess: work.titleGuess,
    mediaType: work.mediaType,
    role: work.role,
    confidence: work.confidence,
    evidence: work.evidence,
    rationale: work.rationale,
    modelVersion: model,
    promptVersion,
    createdAt,
  }))
}
