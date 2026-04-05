import { getEnv } from '../../config/env.ts'
import { AppError, TimeoutError } from '../../lib/errors.ts'

export type YtDlpResult = {
  stdout: string
  stderr: string
}

export type RunYtDlpOptions = {
  timeoutMs?: number
}

export async function runYtDlp(
  binary: string,
  args: string[],
  options: RunYtDlpOptions = {},
): Promise<YtDlpResult> {
  const timeoutMs = options.timeoutMs ?? getEnv().ytDlpTimeoutMs
  const controller = new AbortController()
  let didTimeout = false
  const timeoutId = setTimeout(() => {
    didTimeout = true
    controller.abort()
  }, timeoutMs)

  const command = new Deno.Command(binary, {
    args,
    stdout: 'piped',
    stderr: 'piped',
    signal: controller.signal,
  })

  try {
    const result = await command.output()
    const stdout = new TextDecoder().decode(result.stdout)
    const stderr = new TextDecoder().decode(result.stderr)

    if (didTimeout) {
      throw new TimeoutError(`yt-dlp timed out after ${timeoutMs}ms`)
    }

    if (!result.success) {
      throw new AppError(
        `yt-dlp failed with exit code ${result.code}`,
        'YTDLP_FAILED',
        stderr || stdout,
      )
    }

    return { stdout, stderr }
  } catch (error) {
    if (
      didTimeout ||
      (error instanceof DOMException && error.name === 'AbortError')
    ) {
      throw new TimeoutError(`yt-dlp timed out after ${timeoutMs}ms`, error)
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
