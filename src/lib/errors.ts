export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly cause?: unknown,
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
