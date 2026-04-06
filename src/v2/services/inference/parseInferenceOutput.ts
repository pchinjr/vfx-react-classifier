import { ValidationError } from '../../../lib/errors.ts'
import type {
  WorkInferenceMediaType,
  WorkInferenceRole,
} from '../../domain/workInference.ts'

export type ParsedWorkInference = {
  titleGuess: string
  mediaType: WorkInferenceMediaType
  role: WorkInferenceRole
  confidence: number
  evidence: string[]
  rationale?: string
}

export type ParsedWorkInferenceOutput = {
  works: ParsedWorkInference[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseMediaType(value: unknown): WorkInferenceMediaType {
  if (value === 'movie' || value === 'tv' || value === 'unknown') {
    return value
  }
  throw new ValidationError(`Invalid work inference mediaType: ${value}`)
}

function parseRole(value: unknown): WorkInferenceRole {
  if (value === 'primary' || value === 'secondary') {
    return value
  }
  throw new ValidationError(`Invalid work inference role: ${value}`)
}

function parseConfidence(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError('Work inference confidence must be a number')
  }
  if (value < 0 || value > 1) {
    throw new ValidationError(
      'Work inference confidence must be between 0 and 1',
    )
  }
  return Number(value.toFixed(4))
}

function parseEvidence(value: unknown) {
  if (!Array.isArray(value)) {
    throw new ValidationError('Work inference evidence must be an array')
  }
  return value.flatMap((item) => {
    if (typeof item !== 'string') {
      return []
    }
    const trimmed = item.trim()
    return trimmed ? [trimmed] : []
  })
}

function parseWork(value: unknown): ParsedWorkInference {
  if (!isRecord(value)) {
    throw new ValidationError('Work inference item must be an object')
  }

  if (typeof value.titleGuess !== 'string' || !value.titleGuess.trim()) {
    throw new ValidationError('Work inference titleGuess is required')
  }

  const rationale = typeof value.rationale === 'string' &&
      value.rationale.trim()
    ? value.rationale.trim()
    : undefined

  return {
    titleGuess: value.titleGuess.trim(),
    mediaType: parseMediaType(value.mediaType),
    role: parseRole(value.role),
    confidence: parseConfidence(value.confidence),
    evidence: parseEvidence(value.evidence),
    rationale,
  }
}

export function parseInferenceOutput(
  content: string,
): ParsedWorkInferenceOutput {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (error) {
    throw new ValidationError('Work inference output was not valid JSON', error)
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.works)) {
    throw new ValidationError('Work inference output must contain works array')
  }

  return {
    works: parsed.works.map(parseWork),
  }
}
