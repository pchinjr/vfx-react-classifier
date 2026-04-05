import { AppError } from '../../lib/errors.ts'

export type YtDlpResult = {
  stdout: string
  stderr: string
}

export async function runYtDlp(
  binary: string,
  args: string[],
): Promise<YtDlpResult> {
  const command = new Deno.Command(binary, {
    args,
    stdout: 'piped',
    stderr: 'piped',
  })

  const result = await command.output()
  const stdout = new TextDecoder().decode(result.stdout)
  const stderr = new TextDecoder().decode(result.stderr)

  if (!result.success) {
    throw new AppError(
      `yt-dlp failed with exit code ${result.code}`,
      'YTDLP_FAILED',
      stderr || stdout,
    )
  }

  return { stdout, stderr }
}
