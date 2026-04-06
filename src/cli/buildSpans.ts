import { initializeDatabase, openDatabase } from '../services/storage/db.ts'
import {
  replaceDiscussionSpansForEpisode,
  upsertDiscussionSpans,
} from '../services/storage/discussionSpansRepo.ts'
import { getSegmentsForEpisode } from '../services/storage/segmentsRepo.ts'
import { buildDiscussionSpans } from '../services/spans/buildDiscussionSpans.ts'
import {
  handleCliError,
  parseBooleanFlag,
  parseNumberFlag,
  parseStringFlag,
} from './shared.ts'

const args = [...Deno.args]
const episodeId = parseStringFlag(args, '--episode')
const force = parseBooleanFlag(args, '--force')
const maxGapSeconds = parseNumberFlag(args, '--max-gap-seconds') ?? 15
const maxSpanSeconds = parseNumberFlag(args, '--max-span-seconds') ?? 180
const db = openDatabase()

try {
  initializeDatabase(db)

  if (!episodeId) {
    throw new Error(
      'Usage: deno task spans:build --episode <episode-id> [--force]',
    )
  }

  const segments = getSegmentsForEpisode(db, episodeId)
  const spans = buildDiscussionSpans(segments, {
    maxGapSeconds,
    maxSpanSeconds,
  })

  if (force) {
    replaceDiscussionSpansForEpisode(db, episodeId, spans)
  } else {
    upsertDiscussionSpans(db, spans)
  }

  console.log(`Episode: ${episodeId}`)
  console.log(`Segments: ${segments.length}`)
  console.log(`Discussion spans: ${spans.length}`)
  console.log(`Mode: ${force ? 'replace' : 'upsert'}`)
} catch (error) {
  handleCliError(error)
} finally {
  db.close()
}
