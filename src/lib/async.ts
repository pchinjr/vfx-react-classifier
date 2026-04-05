import { TimeoutError } from './errors.ts'

// Wrap a promise with a wall-clock timeout. This is used around external work
// so a stalled subprocess or network request cannot hang the CLI indefinitely.
export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TimeoutError(`Invalid timeout: ${timeoutMs}`)
  }

  let timeoutId: number | undefined

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new TimeoutError(message)),
          timeoutMs,
        )
      }),
    ])
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}
