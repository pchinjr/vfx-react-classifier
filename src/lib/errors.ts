// AppError gives CLI code a stable shape for user-facing failures while still
// preserving the original cause when needed for debugging.
export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    override readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class MissingCaptionsError extends AppError {
  constructor(message = 'No captions were available for this video') {
    super(message, 'MISSING_CAPTIONS')
  }
}

export class EmptyTranscriptError extends AppError {
  constructor(message = 'Transcript was empty after normalization') {
    super(message, 'EMPTY_TRANSCRIPT')
  }
}

export class MissingApiKeyError extends AppError {
  constructor(message = 'OPENAI_API_KEY is required for embeddings') {
    super(message, 'MISSING_API_KEY')
  }
}

export class TimeoutError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 'TIMEOUT', cause)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 'VALIDATION_ERROR', cause)
  }
}
