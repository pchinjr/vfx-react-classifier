import type { SearchResult } from '../domain/search.ts'
import { AppError } from '../lib/errors.ts'
import { formatTimestamp } from '../lib/time.ts'

export function parseBooleanFlag(args: string[], flag: string) {
  return args.includes(flag)
}

export function parseStringFlag(args: string[], flag: string) {
  const index = args.findIndex((arg) => arg === flag)
  if (index < 0) {
    return null
  }

  return args[index + 1] ?? null
}

// Query output is intentionally plain text so it works well in terminals and
// stays easy to redirect into files later if needed.
export function printSearchResults(results: SearchResult[]) {
  if (!results.length) {
    console.log('No matches found.')
    return
  }

  for (const result of results) {
    console.log(
      `${result.episodeTitle} | ${formatTimestamp(result.start)}-${
        formatTimestamp(result.end)
      } | score=${result.score.toFixed(4)}`,
    )
    console.log(result.text)
    console.log('')
  }
}

// Centralized CLI error handling keeps command entrypoints thin and ensures the
// user sees stable error codes for expected failure modes.
export function handleCliError(error: unknown) {
  if (error instanceof AppError) {
    console.error(`[${error.code}] ${error.message}`)
    if (error.cause) {
      console.error(String(error.cause))
    }
    Deno.exit(1)
  }

  console.error(error instanceof Error ? error.message : String(error))
  Deno.exit(1)
}
