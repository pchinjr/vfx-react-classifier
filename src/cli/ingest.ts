import { handleCliError, parseBooleanFlag } from './shared.ts'
import { initializeDatabase, openDatabase } from '../services/storage/db.ts'
import {
  ingestEpisodeUrl,
  ingestMany,
  parseBatchFile,
  printIngestSummary,
} from './ingestHelpers.ts'

// CLI entrypoint for one-off and batch ingest operations.
const args = [...Deno.args]
const batchMode = parseBooleanFlag(args, '--batch')
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
    const url = args[0]
    if (!url) {
      throw new Error('Usage: deno task ingest <youtube-url>')
    }

    const summary = await ingestEpisodeUrl(db, url)
    printIngestSummary(summary)
  }
} catch (error) {
  handleCliError(error)
} finally {
  db.close()
}
