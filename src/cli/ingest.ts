import { handleCliError, parseBooleanFlag, parseStringFlag } from './shared.ts'
import { initializeDatabase, openDatabase } from '../services/storage/db.ts'
import {
  ingestEpisodeFromTranscriptFile,
  ingestEpisodeUrl,
  ingestMany,
  parseBatchFile,
  printIngestSummary,
} from './ingestHelpers.ts'

// CLI entrypoint for one-off and batch ingest operations.
const args = [...Deno.args]
const batchMode = parseBooleanFlag(args, '--batch')
const transcriptPath = parseStringFlag(args, '--transcript')
const db = openDatabase()

try {
  initializeDatabase(db)

  if (batchMode) {
    const filePath = args.find((arg) => !arg.startsWith('--'))
    if (!filePath) {
      throw new Error('Batch mode requires a file path')
    }

    const urls = parseBatchFile(await Deno.readTextFile(filePath))
    const summaries = await ingestMany(db, urls)
    summaries.forEach(printIngestSummary)
  } else {
    const positionalArgs = args.filter((arg, index) =>
      !arg.startsWith('--') && args[index - 1] !== '--transcript'
    )
    const url = positionalArgs[0]
    if (!url) {
      throw new Error(
        'Usage: deno task ingest <youtube-url> [--transcript <file>]',
      )
    }

    const summary = transcriptPath
      ? await ingestEpisodeFromTranscriptFile(db, url, transcriptPath)
      : await ingestEpisodeUrl(db, url)
    printIngestSummary(summary)
  }
} catch (error) {
  handleCliError(error)
} finally {
  db.close()
}
